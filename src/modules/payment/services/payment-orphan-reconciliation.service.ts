import { Injectable } from '@nestjs/common';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { subMinutes } from 'date-fns';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { BookingMetricsService } from '../../bookings/metrics/booking-metrics.service';
import { ORPHAN_PENDING_RECONCILE_MINUTES } from '../constants/payment-session.constants';
import {
  ORPHAN_PENDING_BATCH_SIZE,
  ORPHAN_PENDING_MAX_BATCHES_PER_RUN,
} from '../constants/payment-maintenance.constants';
import { PaymentPendingRollbackService } from './payment-pending-rollback.service';
import { parsePaymentProviderMeta } from '../types/payment-provider-meta.types';

@Injectable()
export class PaymentOrphanReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentPendingRollback: PaymentPendingRollbackService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly logger: Logger,
  ) {}

  async reconcileOrphanPendingPayments(
    now = new Date(),
    batchSize = ORPHAN_PENDING_BATCH_SIZE,
    maxBatches = ORPHAN_PENDING_MAX_BATCHES_PER_RUN,
  ): Promise<number> {
    const startedAt = Date.now();

    try {
      let totalReconciled = 0;

      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const reconciledInBatch = await this.reconcileOrphanPendingPaymentsBatch(now, batchSize);
        totalReconciled += reconciledInBatch;

        if (reconciledInBatch < batchSize) {
          break;
        }
      }

      this.bookingMetrics.recordMaintenanceRun('reconcile_orphan_payments', 'success');
      this.bookingMetrics.observeMaintenanceDuration(
        'reconcile_orphan_payments',
        (Date.now() - startedAt) / 1000,
      );
      this.bookingMetrics.recordMaintenanceItemsProcessed(
        'reconcile_orphan_payments',
        totalReconciled,
      );

      return totalReconciled;
    } catch (error) {
      this.bookingMetrics.recordMaintenanceRun('reconcile_orphan_payments', 'failure');
      throw error;
    }
  }

  private async reconcileOrphanPendingPaymentsBatch(now: Date, batchSize: number): Promise<number> {
    const staleBefore = subMinutes(now, ORPHAN_PENDING_RECONCILE_MINUTES);

    const orphans = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        externalId: null,
        updatedAt: { lt: staleBefore },
        booking: { status: BookingStatus.PAYMENT_PENDING },
      },
      select: {
        id: true,
        bookingId: true,
        provider: true,
        status: true,
        providerMeta: true,
      },
      take: batchSize,
    });

    let reconciled = 0;

    for (const orphan of orphans) {
      const pendingSessionId = parsePaymentProviderMeta(
        orphan.providerMeta,
      ).pendingProviderSessionId;

      if (pendingSessionId) {
        await this.prisma.transaction.update({
          where: { id: orphan.id },
          data: { externalId: pendingSessionId },
        });
        this.logger.warn(
          { transactionId: orphan.id, bookingId: orphan.bookingId, externalId: pendingSessionId },
          'Recovered orphan pending payment externalId from provider meta',
        );
        reconciled += 1;
        continue;
      }

      await this.paymentPendingRollback.rollbackPendingPayment(orphan.bookingId, orphan.id);
      this.logger.warn(
        { transactionId: orphan.id, bookingId: orphan.bookingId },
        'Rolled back orphan pending payment without provider session',
      );
      reconciled += 1;
    }

    return reconciled;
  }
}
