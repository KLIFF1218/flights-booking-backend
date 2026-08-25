import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { SchedulerService } from './scheduler.service';
import { SeatReleaseService } from '../../bookings/services/seats/seat-release.service';
import { BookingExpirationService } from '../../bookings/services/lifecycle/booking-expiration.service';
import { PaymentAbandonmentService } from '../../payment/services/payment-abandonment.service';
import { PaymentOrphanReconciliationService } from '../../payment/services/payment-orphan-reconciliation.service';
import { SchedulerLockService } from './scheduler-lock.service';
import { SchedulerMetricsService } from './scheduler-metrics.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let module: TestingModule;

  const seatReleaseService = {
    releaseExpiredHolds: jest.fn(),
  };
  const bookingExpirationService = {
    expireStaleBookings: jest.fn(),
  };
  const paymentAbandonmentService = {
    expireStalePayments: jest.fn(),
  };
  const paymentOrphanReconciliationService = {
    reconcileOrphanPendingPayments: jest.fn(),
  };
  const schedulerLock = {
    tryAcquireBookingMaintenanceLock: jest.fn(),
  };
  const schedulerMetrics = {
    recordMaintenancePipelineStepFailed: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    schedulerLock.tryAcquireBookingMaintenanceLock.mockResolvedValue(true);
    bookingExpirationService.expireStaleBookings.mockResolvedValue(0);
    paymentAbandonmentService.expireStalePayments.mockResolvedValue(0);
    paymentOrphanReconciliationService.reconcileOrphanPendingPayments.mockResolvedValue(0);
    seatReleaseService.releaseExpiredHolds.mockResolvedValue(0);

    module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: SeatReleaseService, useValue: seatReleaseService },
        { provide: BookingExpirationService, useValue: bookingExpirationService },
        { provide: PaymentAbandonmentService, useValue: paymentAbandonmentService },
        {
          provide: PaymentOrphanReconciliationService,
          useValue: paymentOrphanReconciliationService,
        },
        { provide: SchedulerLockService, useValue: schedulerLock },
        { provide: SchedulerMetricsService, useValue: schedulerMetrics },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('runBookingMaintenance', () => {
    it('skips the pipeline when the distributed lock is not acquired', async () => {
      schedulerLock.tryAcquireBookingMaintenanceLock.mockResolvedValue(false);

      await service.runBookingMaintenance();

      expect(bookingExpirationService.expireStaleBookings).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Skipping booking maintenance — lock held by another instance',
      );
    });

    it('runs expiration, orphan reconciliation, payment abandonment, then hold release', async () => {
      const callOrder: string[] = [];

      bookingExpirationService.expireStaleBookings.mockImplementation(async () => {
        callOrder.push('expire');
        return 2;
      });
      paymentOrphanReconciliationService.reconcileOrphanPendingPayments.mockImplementation(
        async () => {
          callOrder.push('reconcile');
          return 0;
        },
      );
      paymentAbandonmentService.expireStalePayments.mockImplementation(async () => {
        callOrder.push('abandon');
        return 1;
      });
      seatReleaseService.releaseExpiredHolds.mockImplementation(async () => {
        callOrder.push('holds');
        return 0;
      });

      await service.runBookingMaintenance();

      expect(callOrder).toEqual(['expire', 'reconcile', 'abandon', 'holds']);
    });

    it('logs counts only when maintenance work was performed', async () => {
      bookingExpirationService.expireStaleBookings.mockResolvedValue(3);
      paymentOrphanReconciliationService.reconcileOrphanPendingPayments.mockResolvedValue(1);
      paymentAbandonmentService.expireStalePayments.mockResolvedValue(2);

      await service.runBookingMaintenance();

      expect(logger.log).toHaveBeenCalledWith('Expired 3 bookings');
      expect(logger.log).toHaveBeenCalledWith('Reconciled 1 orphan pending payment sessions');
      expect(logger.log).toHaveBeenCalledWith('Abandoned 2 stale payment sessions');
    });

    it('still releases holds when no bookings or payments expired', async () => {
      await service.runBookingMaintenance();

      expect(bookingExpirationService.expireStaleBookings).toHaveBeenCalled();
      expect(paymentOrphanReconciliationService.reconcileOrphanPendingPayments).toHaveBeenCalled();
      expect(paymentAbandonmentService.expireStalePayments).toHaveBeenCalled();
      expect(seatReleaseService.releaseExpiredHolds).toHaveBeenCalled();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('continues the pipeline when booking expiration fails', async () => {
      const error = new Error('expire failed');
      bookingExpirationService.expireStaleBookings.mockRejectedValue(error);

      await service.runBookingMaintenance();

      expect(schedulerMetrics.recordMaintenancePipelineStepFailed).toHaveBeenCalledWith(
        'expire_bookings',
      );
      expect(logger.error).toHaveBeenCalledWith(
        error,
        'Booking maintenance step failed: expire_bookings',
      );
      expect(paymentOrphanReconciliationService.reconcileOrphanPendingPayments).toHaveBeenCalled();
      expect(paymentAbandonmentService.expireStalePayments).toHaveBeenCalled();
      expect(seatReleaseService.releaseExpiredHolds).toHaveBeenCalled();
    });

    it('continues the pipeline when payment abandonment fails', async () => {
      const error = new Error('abandon failed');
      paymentAbandonmentService.expireStalePayments.mockRejectedValue(error);

      await service.runBookingMaintenance();

      expect(bookingExpirationService.expireStaleBookings).toHaveBeenCalled();
      expect(schedulerMetrics.recordMaintenancePipelineStepFailed).toHaveBeenCalledWith(
        'abandon_payments',
      );
      expect(seatReleaseService.releaseExpiredHolds).toHaveBeenCalled();
    });

    it('records metrics when orphan reconciliation fails but still runs later steps', async () => {
      const error = new Error('reconcile failed');
      paymentOrphanReconciliationService.reconcileOrphanPendingPayments.mockRejectedValue(error);

      await service.runBookingMaintenance();

      expect(schedulerMetrics.recordMaintenancePipelineStepFailed).toHaveBeenCalledWith(
        'reconcile_orphan_payments',
      );
      expect(paymentAbandonmentService.expireStalePayments).toHaveBeenCalled();
      expect(seatReleaseService.releaseExpiredHolds).toHaveBeenCalled();
    });
  });
});
