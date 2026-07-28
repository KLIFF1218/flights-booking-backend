import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentProvider, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { PaymentProviderService } from './payment-provider.service';
import { SeatReleaseService } from '../../bookings/services/seat-release.service';
import { BookingsCacheService } from '../../bookings/services/bookings-cache.service';
import { releaseFlightInstanceInventoryForBooking } from '../../bookings/utils/booking-inventory.util';
import { BookingSnapshot } from '../../bookings/interfaces/booking-snapshot.interface';
import { BookingMetricsService } from '../../bookings/metrics/booking-metrics.service';
import {
  cancelTransactionIfAbandonable,
  isAbandonableTransactionStatus,
  markBookingExpiredIfPaymentPending,
} from '../utils/transaction-state.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

type AbandonPaymentCandidate = {
  id: string;
  userId: string;
  status: BookingStatus;
  transaction: {
    id: string;
    status: TransactionStatus;
    provider: PaymentProvider;
    externalId: string | null;
  } | null;
};

@Injectable()
export class PaymentAbandonmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviderService: PaymentProviderService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly metrics: MetricsService,
  ) {}

  async expireStalePayments(now = new Date(), batchSize = 100): Promise<number> {
    const startedAt = Date.now();

    try {
      const staleBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.PAYMENT_PENDING,
          transaction: {
            status: {
              in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED],
            },
            paymentExpiresAt: { lt: now },
          },
        },
        select: { id: true },
        take: batchSize,
      });

      let expiredCount = 0;

      for (const booking of staleBookings) {
        if (await this.abandonPayment(booking.id)) {
          expiredCount += 1;
        }
      }

      this.bookingMetrics.recordMaintenanceRun('abandon_payments', 'success');
      this.bookingMetrics.observeMaintenanceDuration(
        'abandon_payments',
        (Date.now() - startedAt) / 1000,
      );
      this.bookingMetrics.recordMaintenanceItemsProcessed('abandon_payments', expiredCount);

      return expiredCount;
    } catch (error) {
      this.bookingMetrics.recordMaintenanceRun('abandon_payments', 'failure');
      throw error;
    }
  }

  async abandonPayment(bookingId: string): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    if (!booking || !this.canAbandon(booking) || !booking.transaction) {
      return false;
    }

    const transaction = booking.transaction;

    const abandoned = await this.prisma.$transaction(
      async (tx) => {
        const canceled = await cancelTransactionIfAbandonable(tx, transaction.id);
        if (!canceled) {
          return false;
        }

        const expired = await markBookingExpiredIfPaymentPending(tx, bookingId);
        if (!expired) {
          return false;
        }

        await this.seatReleaseService.releaseSeatsForBooking(bookingId, tx, 'payment_abandoned');

        const snapshot = booking.snapshot as unknown as BookingSnapshot;
        await releaseFlightInstanceInventoryForBooking(tx, bookingId, snapshot);
        this.bookingMetrics.recordInventoryReleased('payment_abandoned');

        return true;
      },
      { timeout: 15_000 },
    );

    if (abandoned) {
      await this.cancelPendingPaymentAtProviderBestEffort(transaction);
      await this.bookingsCache.invalidateBooking(bookingId, booking.userId);
      this.bookingMetrics.recordBookingExpired('payment_abandoned');
      runSafely(() => this.metrics.recordPaymentAbandoned(String(transaction.provider), 'expired'));
      this.logger.log({ bookingId }, 'Payment session abandoned');
    }

    return abandoned;
  }

  async cancelPendingPaymentAtProviderBestEffort(transaction: {
    status: TransactionStatus;
    provider: PaymentProvider;
    externalId: string | null;
    id: string;
  }): Promise<void> {
    if (!isAbandonableTransactionStatus(transaction.status) || !transaction.externalId) {
      return;
    }

    try {
      await this.paymentProviderService.cancelPendingPayment(
        transaction.provider,
        transaction.externalId,
      );
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error instanceof Error ? error : String(error),
          transactionId: transaction.id,
          provider: transaction.provider,
          externalId: transaction.externalId,
        },
        'Failed to cancel pending payment at provider',
      );
    }
  }

  async refundLateSuccessBestEffort(
    provider: PaymentProvider,
    paymentId: string,
    transactionId: string,
  ): Promise<void> {
    try {
      await this.paymentProviderService.refundSucceededPayment(provider, paymentId);
    } catch (error: unknown) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          transactionId,
          provider,
          paymentId,
        },
        'Failed to refund late successful payment',
      );
      throw error;
    }
  }

  async compensateTicketingFailure(bookingId: string, reason: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    if (!booking) {
      this.logger.warn(
        { bookingId, reason },
        'Skipping ticketing compensation for missing booking',
      );
      return;
    }

    const transaction = booking.transaction;
    const refundRequired =
      transaction?.status === TransactionStatus.SUCCEED && Boolean(transaction.externalId);

    if (this.hasTicketingCompensationCompleted(transaction?.providerMeta, refundRequired)) {
      this.logger.warn({ bookingId, reason }, 'Ticketing failure compensation already completed');
      return;
    }

    if (refundRequired && transaction?.externalId) {
      if (!this.hasTicketingRefundCompleted(transaction.providerMeta)) {
        await this.refundTicketingFailurePayment(bookingId, reason, {
          id: transaction.id,
          provider: transaction.provider,
          externalId: transaction.externalId,
        });
        await this.markTicketingRefundCompleted(transaction.id, reason, transaction.providerMeta);
      }
    } else if (transaction?.status === TransactionStatus.SUCCEED && !transaction.externalId) {
      this.logger.error(
        { bookingId, reason, transactionId: transaction.id },
        'Cannot compensate ticketing failure without payment external id',
      );
      throw new Error('Ticketing failure refund requires payment external id');
    }

    if (this.hasTicketingInventoryReleased(transaction?.providerMeta)) {
      return;
    }

    await this.finalizeTicketingFailureCompensation(booking, transaction, reason);
  }

  private async refundTicketingFailurePayment(
    bookingId: string,
    reason: string,
    transaction: {
      id: string;
      provider: PaymentProvider;
      externalId: string;
    },
  ): Promise<void> {
    try {
      await this.paymentProviderService.refundSucceededPayment(
        transaction.provider,
        transaction.externalId,
        `ticketing-fail-refund-${transaction.id}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          bookingId,
          reason,
          transactionId: transaction.id,
          err: error instanceof Error ? error : String(error),
        },
        'Failed to refund payment after ticketing failure',
      );
      throw error;
    }
  }

  private async markTicketingRefundCompleted(
    transactionId: string,
    reason: string,
    providerMeta: unknown,
  ): Promise<void> {
    const meta =
      providerMeta && typeof providerMeta === 'object'
        ? (providerMeta as Record<string, unknown>)
        : {};

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerMeta: {
          ...meta,
          ticketingFailedRefundCompleted: true,
          ticketingFailedReason: reason,
          ticketingFailedRefundedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async finalizeTicketingFailureCompensation(
    booking: {
      id: string;
      userId: string;
      snapshot: unknown;
    },
    transaction: {
      id: string;
      providerMeta: unknown;
    } | null,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        if (transaction) {
          const current = await tx.transaction.findUnique({
            where: { id: transaction.id },
            select: { providerMeta: true },
          });

          if (this.hasTicketingInventoryReleased(current?.providerMeta)) {
            return;
          }
        }

        await this.seatReleaseService.releaseSeatsForBooking(booking.id, tx, 'ticketing_failed');

        const snapshot = booking.snapshot as BookingSnapshot;
        await releaseFlightInstanceInventoryForBooking(tx, booking.id, snapshot);
        this.bookingMetrics.recordInventoryReleased('ticketing_failed');

        if (transaction) {
          const providerMeta =
            transaction.providerMeta && typeof transaction.providerMeta === 'object'
              ? (transaction.providerMeta as Record<string, unknown>)
              : {};

          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              providerMeta: {
                ...providerMeta,
                ticketingFailedRefundCompleted: true,
                ticketingFailedInventoryReleased: true,
                ticketingFailedReason: reason,
                ticketingFailedAt: new Date().toISOString(),
              },
            },
          });
        }
      },
      { timeout: 15_000 },
    );

    await this.bookingsCache.invalidateBooking(booking.id, booking.userId);
    this.logger.error(
      { bookingId: booking.id, reason },
      'Ticketing failure compensation completed',
    );
  }

  private hasTicketingRefundCompleted(providerMeta: unknown): boolean {
    if (!providerMeta || typeof providerMeta !== 'object') {
      return false;
    }

    return (providerMeta as Record<string, unknown>).ticketingFailedRefundCompleted === true;
  }

  private hasTicketingInventoryReleased(providerMeta: unknown): boolean {
    if (!providerMeta || typeof providerMeta !== 'object') {
      return false;
    }

    return (providerMeta as Record<string, unknown>).ticketingFailedInventoryReleased === true;
  }

  private hasTicketingCompensationCompleted(
    providerMeta: unknown,
    refundRequired: boolean,
  ): boolean {
    if (refundRequired) {
      return (
        this.hasTicketingRefundCompleted(providerMeta) &&
        this.hasTicketingInventoryReleased(providerMeta)
      );
    }

    return this.hasTicketingInventoryReleased(providerMeta);
  }

  async markLateSuccessRefunded(
    transactionId: string,
    paymentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });

    const providerMeta =
      transaction?.providerMeta && typeof transaction.providerMeta === 'object'
        ? (transaction.providerMeta as Record<string, unknown>)
        : {};

    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        externalId: paymentId,
        providerMeta: {
          ...providerMeta,
          lateSuccessRefunded: true,
          lateSuccessRefundedAt: new Date().toISOString(),
        },
      },
    });
  }

  private canAbandon(booking: AbandonPaymentCandidate): boolean {
    return (
      booking.status === BookingStatus.PAYMENT_PENDING &&
      Boolean(booking.transaction && isAbandonableTransactionStatus(booking.transaction.status))
    );
  }
}
