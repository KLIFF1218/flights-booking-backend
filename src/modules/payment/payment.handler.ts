import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { PaymentWebhookResult } from './interfaces/payment-webhook-result.dto';
import { Logger } from 'nestjs-pino';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { EnumTransport } from '@prisma/client';
import { IdempotencyService } from './services/idempotency.service';
import { SeatReleaseService } from '../bookings/services/seat-release.service';
import { BookingsCacheService } from '../bookings/services/bookings-cache.service';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import { PaymentAbandonmentService } from './services/payment-abandonment.service';
import {
  finalizeTransactionIfPending,
  finalizeTransactionToSucceed,
  markBookingCanceledIfPaymentPending,
  markBookingPaidIfPending,
  markTransactionAuthorizedIfPending,
} from './utils/transaction-state.util';
import { BookingSnapshot } from '../bookings/interfaces/booking-snapshot.interface';
import { releaseFlightInstanceInventoryForBooking } from '../bookings/utils/booking-inventory.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class PaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly outbox: OutboxService,
    private readonly idempotency: IdempotencyService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
    private readonly metrics: MetricsService,
  ) {}

  async processResult(result: PaymentWebhookResult): Promise<void> {
    const { transactionId, status, paymentId, provider, eventId, method } = result;

    runSafely(() => this.metrics.recordWebhookReceived(provider));

    const operation = await this.idempotency.tryStart(provider, eventId, 'payment-webhook');

    if (!operation) {
      this.logger.warn(
        {
          provider,
          eventId,
        },
        'Webhook already processed',
      );
      runSafely(() => {
        this.metrics.recordPaymentIdempotencyConflict(provider);
        this.metrics.recordWebhookIgnored(provider, 'duplicate');
      });

      return;
    }

    try {
      const occurredAt = new Date().toISOString();
      let invalidateBookingId: string | undefined;
      let invalidateUserId: string | undefined;
      let webhookOutcome: string | undefined;

      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { booking: true },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.status === TransactionStatus.SUCCEED) {
        this.logger.warn(
          { transactionId, status: transaction.status },
          'Transaction already finalized',
        );
        await this.idempotency.complete(operation.id);
        runSafely(() => this.metrics.recordWebhookIgnored(provider, 'already_succeeded'));
        return;
      }

      if (
        status === TransactionStatus.SUCCEED &&
        transaction.status === TransactionStatus.CANCELED &&
        (transaction.booking.status === BookingStatus.EXPIRED ||
          transaction.booking.status === BookingStatus.CANCELED)
      ) {
        invalidateBookingId = await this.reconcileLateSuccess(
          transaction,
          paymentId,
          provider,
          occurredAt,
        );
        invalidateUserId = transaction.booking.userId;

        if (invalidateBookingId && invalidateUserId) {
          await this.bookingsCache.invalidateBooking(invalidateBookingId, invalidateUserId);
        }

        await this.idempotency.complete(operation.id);
        runSafely(() => this.metrics.recordWebhookProcessed(provider, 'late_success_refunded'));
        return;
      }

      if (
        transaction.status === TransactionStatus.CANCELED ||
        transaction.status === TransactionStatus.FAILED
      ) {
        this.logger.warn(
          { transactionId, status: transaction.status },
          'Transaction already finalized',
        );
        await this.idempotency.complete(operation.id);
        runSafely(() => this.metrics.recordWebhookIgnored(provider, 'already_finalized'));
        return;
      }

      let reconcileLateSuccess = false;

      await this.prisma.$transaction(async (tx) => {
        const current = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: { booking: true },
        });

        if (!current) {
          throw new NotFoundException('Transaction not found');
        }

        if (status === TransactionStatus.AUTHORIZED) {
          await markTransactionAuthorizedIfPending(tx, transactionId, {
            externalId: paymentId,
          });
          webhookOutcome = 'authorized';
          return;
        }

        if (status === TransactionStatus.SUCCEED) {
          const finalized = await finalizeTransactionToSucceed(tx, transactionId, {
            externalId: paymentId,
          });

          if (!finalized) {
            if (
              current.booking.status === BookingStatus.EXPIRED ||
              current.booking.status === BookingStatus.CANCELED
            ) {
              reconcileLateSuccess = true;
            } else {
              this.logger.warn(
                {
                  transactionId,
                  bookingId: current.bookingId,
                  bookingStatus: current.booking.status,
                  transactionStatus: current.status,
                },
                'Success webhook could not finalize payable transaction; skipping late-success refund',
              );
              webhookOutcome = 'skipped_unpayable';
            }
            return;
          }

          const markedPaid = await markBookingPaidIfPending(tx, current.bookingId);
          if (!markedPaid) {
            if (
              current.booking.status === BookingStatus.EXPIRED ||
              current.booking.status === BookingStatus.CANCELED
            ) {
              reconcileLateSuccess = true;
            } else {
              this.logger.warn(
                {
                  transactionId,
                  bookingId: current.bookingId,
                  bookingStatus: current.booking.status,
                },
                'Success webhook finalized transaction but booking was not PAYMENT_PENDING; skipping late-success refund',
              );
              webhookOutcome = 'skipped_booking_state';
            }
            return;
          }

          const seats = await tx.seatAssignment.findMany({
            where: { bookingId: current.bookingId },
            select: { flightSeatId: true },
          });

          const seatIds = seats.map((s) => s.flightSeatId);

          await tx.flightSeat.updateMany({
            where: {
              id: { in: seatIds },
            },
            data: {
              status: 'BOOKED',
            },
          });

          await tx.seatHold.deleteMany({
            where: {
              bookingId: current.bookingId,
            },
          });

          await this.outbox.enqueue(tx, {
            aggregateId: current.bookingId,
            aggregateType: 'Booking',
            topic: `${process.env.RABBITMQ_EXCHANGE || 'booking.events'}:booking.paid`,
            payload: {
              bookingId: current.bookingId,
              occurredAt: occurredAt,
            },
            transport: EnumTransport.RABBITMQ,
          });

          await this.outbox.enqueue(tx, {
            aggregateId: current.bookingId,
            aggregateType: 'Booking',
            topic: 'booking.paid',
            payload: {
              bookingId: current.bookingId,
              occurredAt: occurredAt,
            },
            transport: EnumTransport.KAFKA,
          });

          this.logger.log({ bookingId: current.bookingId }, 'Booking marked as PAID');
          logBookingFlowStage(this.logger, BookingFlowStage.PAYMENT_SUCCEEDED, {
            bookingId: current.bookingId,
            transactionId,
            provider,
            paymentId,
          });
          invalidateBookingId = current.bookingId;
          invalidateUserId = current.booking.userId;
          webhookOutcome = 'confirmed';

          runSafely(() => {
            this.metrics.recordPayment(provider, 'confirmed');
            this.metrics.recordPaymentValue(
              Math.round(Number(current.amount) * 100),
              provider,
              'confirmed',
            );
            this.metrics.recordPaymentMethod(method ?? 'unknown', provider);
          });
          return;
        }

        const finalized = await finalizeTransactionIfPending(tx, transactionId, {
          status,
          externalId: paymentId,
        });

        if (!finalized) {
          webhookOutcome = 'noop';
          return;
        }

        if (status === TransactionStatus.CANCELED || status === TransactionStatus.FAILED) {
          const failureReason =
            status === TransactionStatus.FAILED ? 'payment_failed' : 'payment_canceled';

          const canceled = await markBookingCanceledIfPaymentPending(tx, current.bookingId);
          if (!canceled) {
            webhookOutcome = 'noop';
            return;
          }

          await this.seatReleaseService.releaseSeatsForBooking(current.bookingId, tx);

          const snapshot = current.booking.snapshot as unknown as BookingSnapshot;
          if (snapshot) {
            await releaseFlightInstanceInventoryForBooking(tx, current.bookingId, snapshot);
          }

          this.logger.log(
            { bookingId: current.bookingId, reason: failureReason },
            'Booking canceled after payment failure',
          );

          await this.outbox.enqueue(tx, {
            aggregateId: current.bookingId,
            aggregateType: 'Booking',
            topic: 'payment.failed',
            payload: {
              bookingId: current.bookingId,
              userId: current.booking.userId,
              transactionId: current.id,
              reason: failureReason,
              occurredAt: occurredAt,
            },
            transport: EnumTransport.KAFKA,
          });
          invalidateBookingId = current.bookingId;
          invalidateUserId = current.booking.userId;
          webhookOutcome = status === TransactionStatus.FAILED ? 'failed' : 'canceled';

          runSafely(() => {
            this.metrics.recordPayment(provider, webhookOutcome!);
            this.metrics.recordPaymentValue(
              Math.round(Number(current.amount) * 100),
              provider,
              webhookOutcome!,
            );
          });
        }
      });

      if (reconcileLateSuccess) {
        invalidateBookingId = await this.reconcileLateSuccess(
          transaction,
          paymentId,
          provider,
          occurredAt,
        );
        invalidateUserId = transaction.booking.userId;
        webhookOutcome = 'late_success_refunded';
      }

      if (invalidateBookingId && invalidateUserId) {
        await this.bookingsCache.invalidateBooking(invalidateBookingId, invalidateUserId);
      }

      await this.idempotency.complete(operation.id);
      if (webhookOutcome) {
        runSafely(() => this.metrics.recordWebhookProcessed(provider, webhookOutcome!));
      }
    } catch (error) {
      await this.idempotency.fail(operation.id);
      runSafely(() => this.metrics.recordWebhookProcessed(provider, 'error'));
      throw error;
    }
  }

  private async reconcileLateSuccess(
    transaction: {
      id: string;
      bookingId: string;
      booking: { status: BookingStatus };
      providerMeta: unknown;
    },
    paymentId: string,
    provider: PaymentWebhookResult['provider'],
    occurredAt: string,
  ): Promise<string> {
    const providerMeta =
      transaction.providerMeta && typeof transaction.providerMeta === 'object'
        ? (transaction.providerMeta as Record<string, unknown>)
        : {};

    if (providerMeta.lateSuccessRefunded === true) {
      this.logger.warn(
        { transactionId: transaction.id, bookingId: transaction.bookingId },
        'Late successful payment already refunded',
      );
      return transaction.bookingId;
    }

    await this.paymentAbandonmentService.refundLateSuccessBestEffort(
      provider,
      paymentId,
      transaction.id,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.paymentAbandonmentService.markLateSuccessRefunded(transaction.id, paymentId, tx);

      await this.outbox.enqueue(tx, {
        aggregateId: transaction.bookingId,
        aggregateType: 'Booking',
        topic: 'payment.reconciliation.refunded',
        payload: {
          bookingId: transaction.bookingId,
          transactionId: transaction.id,
          paymentId,
          reason: 'late_success_after_expiration',
          occurredAt,
        },
        transport: EnumTransport.KAFKA,
      });
    });

    this.logger.warn(
      {
        bookingId: transaction.bookingId,
        transactionId: transaction.id,
        paymentId,
      },
      'Late successful payment refunded after booking expiration',
    );

    return transaction.bookingId;
  }
}
