import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentProvider, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { PaymentProviderService } from './payment-provider.service';
import { BookingPaymentLifecycleService } from '../../bookings/services/booking-payment-lifecycle.service';
import { BookingMetricsService } from '../../bookings/metrics/booking-metrics.service';
import {
  cancelTransactionIfAbandonable,
  isAbandonableTransactionStatus,
} from '../utils/transaction-state.util';
import { canAbandonPayment } from '../domain/payment-webhook.policy';
import {
  hasTicketingCompensationCompleted,
  hasTicketingInventoryReleased,
  hasTicketingRefundCompleted,
  isTicketingCompensationRecorded,
} from '../domain/payment-reconciliation.policy';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import {
  PAYMENT_ABANDON_BATCH_SIZE,
  PAYMENT_ABANDON_MAX_BATCHES_PER_RUN,
} from '../constants/payment-maintenance.constants';
import { mergePaymentProviderMeta } from '../types/payment-provider-meta.types';

@Injectable()
export class PaymentAbandonmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviderService: PaymentProviderService,
    private readonly bookingPaymentLifecycle: BookingPaymentLifecycleService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly metrics: MetricsService,
  ) {}

  async expireStalePayments(
    now = new Date(),
    batchSize = PAYMENT_ABANDON_BATCH_SIZE,
    maxBatches = PAYMENT_ABANDON_MAX_BATCHES_PER_RUN,
  ): Promise<number> {
    const startedAt = Date.now();

    try {
      let totalExpired = 0;

      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const expiredInBatch = await this.expireStalePaymentsBatch(now, batchSize);
        totalExpired += expiredInBatch;

        if (expiredInBatch < batchSize) {
          break;
        }
      }

      this.bookingMetrics.recordMaintenanceRun('abandon_payments', 'success');
      this.bookingMetrics.observeMaintenanceDuration(
        'abandon_payments',
        (Date.now() - startedAt) / 1000,
      );
      this.bookingMetrics.recordMaintenanceItemsProcessed('abandon_payments', totalExpired);

      return totalExpired;
    } catch (error) {
      this.bookingMetrics.recordMaintenanceRun('abandon_payments', 'failure');
      throw error;
    }
  }

  private async expireStalePaymentsBatch(now: Date, batchSize: number): Promise<number> {
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

    return expiredCount;
  }

  async abandonPayment(bookingId: string): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    if (!booking || !canAbandonPayment(booking.status, booking.transaction?.status)) {
      return false;
    }

    const transaction = booking.transaction!;

    const abandoned = await this.prisma.$transaction(
      async (tx) => {
        const canceled = await cancelTransactionIfAbandonable(tx, transaction.id);
        if (!canceled) {
          return false;
        }

        return await this.bookingPaymentLifecycle.expireUnpaidPaymentPending(
          tx,
          bookingId,
          booking.snapshot,
        );
      },
      { timeout: 15_000 },
    );

    if (abandoned) {
      await this.cancelPendingPaymentAtProviderBestEffort(transaction);
      await this.bookingPaymentLifecycle.invalidateBooking(bookingId, booking.userId);
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

    await this.paymentProviderService.cancelPendingPaymentBestEffort(
      transaction.provider,
      transaction.externalId,
      { transactionId: transaction.id },
    );
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

    if (hasTicketingCompensationCompleted(transaction?.providerMeta, refundRequired)) {
      this.logger.warn({ bookingId, reason }, 'Ticketing failure compensation already completed');
      return;
    }

    if (refundRequired && transaction?.externalId) {
      if (!hasTicketingRefundCompleted(transaction.providerMeta)) {
        if (!isTicketingCompensationRecorded(transaction.providerMeta)) {
          await this.markTicketingCompensationRecorded(
            transaction.id,
            reason,
            transaction.providerMeta,
          );
        }

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

    if (hasTicketingInventoryReleased(transaction?.providerMeta)) {
      return;
    }

    if (transaction && !isTicketingCompensationRecorded(transaction.providerMeta)) {
      await this.markTicketingCompensationRecorded(
        transaction.id,
        reason,
        transaction.providerMeta,
      );
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

  private async markTicketingCompensationRecorded(
    transactionId: string,
    reason: string,
    providerMeta: unknown,
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerMeta: mergePaymentProviderMeta(providerMeta, {
          ticketingCompensationRecorded: true,
          ticketingCompensationRecordedAt: new Date().toISOString(),
          ticketingFailedReason: reason,
        }),
      },
    });
  }

  private async markTicketingRefundCompleted(
    transactionId: string,
    reason: string,
    providerMeta: unknown,
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerMeta: mergePaymentProviderMeta(providerMeta, {
          ticketingFailedRefundCompleted: true,
          ticketingFailedReason: reason,
          ticketingFailedRefundedAt: new Date().toISOString(),
        }),
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

          if (hasTicketingInventoryReleased(current?.providerMeta)) {
            return;
          }
        }

        await this.bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure(
          tx,
          booking.id,
          booking.snapshot,
        );

        if (transaction) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              providerMeta: mergePaymentProviderMeta(transaction.providerMeta, {
                ticketingFailedInventoryReleased: true,
                ticketingFailedReason: reason,
                ticketingFailedAt: new Date().toISOString(),
              }),
            },
          });
        }
      },
      { timeout: 15_000 },
    );

    await this.bookingPaymentLifecycle.invalidateBooking(booking.id, booking.userId);
    this.logger.error(
      { bookingId: booking.id, reason },
      'Ticketing failure compensation completed',
    );
  }

  async markLateSuccessReconciliationRecorded(
    transactionId: string,
    paymentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });

    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        externalId: paymentId,
        providerMeta: mergePaymentProviderMeta(transaction?.providerMeta, {
          lateSuccessReconciliationRecorded: true,
          lateSuccessReconciliationRecordedAt: new Date().toISOString(),
        }),
      },
    });
  }

  async markLateSuccessRefundCompleted(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerMeta: mergePaymentProviderMeta(transaction?.providerMeta, {
          lateSuccessRefunded: true,
          lateSuccessRefundedAt: new Date().toISOString(),
        }),
      },
    });
  }
}
