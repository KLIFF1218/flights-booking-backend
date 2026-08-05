import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { SeatReleaseService } from '../../bookings/services/seat-release.service';
import { BookingExpirationService } from '../../bookings/services/booking-expiration.service';
import { PaymentAbandonmentService } from '../../payment/services/payment-abandonment.service';
import { PaymentOrphanReconciliationService } from '../../payment/services/payment-orphan-reconciliation.service';
import { SchedulerLockService } from './scheduler-lock.service';
import { SchedulerMetricsService } from './scheduler-metrics.service';
import type { BookingMaintenanceStep } from '../constants/scheduler.constants';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
    private readonly paymentOrphanReconciliationService: PaymentOrphanReconciliationService,
    private readonly schedulerLock: SchedulerLockService,
    private readonly schedulerMetrics: SchedulerMetricsService,
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runBookingMaintenance() {
    if (!(await this.schedulerLock.tryAcquireBookingMaintenanceLock())) {
      this.logger.debug('Skipping booking maintenance — lock held by another instance');
      return;
    }

    const expired = await this.runMaintenanceStep('expire_bookings', () =>
      this.bookingExpirationService.expireStaleBookings(),
    );

    if (expired > 0) {
      this.logger.log(`Expired ${expired} bookings`);
    }

    const reconciledOrphans = await this.runMaintenanceStep('reconcile_orphan_payments', () =>
      this.paymentOrphanReconciliationService.reconcileOrphanPendingPayments(),
    );

    if (reconciledOrphans > 0) {
      this.logger.log(`Reconciled ${reconciledOrphans} orphan pending payment sessions`);
    }

    const abandonedPayments = await this.runMaintenanceStep('abandon_payments', () =>
      this.paymentAbandonmentService.expireStalePayments(),
    );

    if (abandonedPayments > 0) {
      this.logger.log(`Abandoned ${abandonedPayments} stale payment sessions`);
    }

    // Runs after expiration so active bookings only get hold TTL resync, not seat release.
    await this.runMaintenanceStep('release_expired_holds', () =>
      this.seatReleaseService.releaseExpiredHolds(),
    );
  }

  private async runMaintenanceStep(
    step: BookingMaintenanceStep,
    fn: () => Promise<number>,
  ): Promise<number> {
    try {
      return await fn();
    } catch (error) {
      this.schedulerMetrics.recordMaintenancePipelineStepFailed(step);
      this.logger.error(error, `Booking maintenance step failed: ${step}`);
      return 0;
    }
  }
}
