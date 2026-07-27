import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { SchedulerService } from './scheduler.service';
import { SeatReleaseService } from '../bookings/services/seat-release.service';
import { BookingExpirationService } from '../bookings/services/booking-expiration.service';
import { PaymentAbandonmentService } from '../payment/services/payment-abandonment.service';
import { CurrencyRatesService } from '../flights/services/currency-rates.service';

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
  const currencyRatesService = {
    refreshRates: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    bookingExpirationService.expireStaleBookings.mockResolvedValue(0);
    paymentAbandonmentService.expireStalePayments.mockResolvedValue(0);
    seatReleaseService.releaseExpiredHolds.mockResolvedValue(0);
    currencyRatesService.refreshRates.mockResolvedValue({ USD: 1, EUR: 0.92, RUB: 90 });

    module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: SeatReleaseService, useValue: seatReleaseService },
        { provide: BookingExpirationService, useValue: bookingExpirationService },
        { provide: PaymentAbandonmentService, useValue: paymentAbandonmentService },
        { provide: CurrencyRatesService, useValue: currencyRatesService },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('runBookingMaintenance', () => {
    it('runs expiration, payment abandonment, then hold release in order', async () => {
      const callOrder: string[] = [];

      bookingExpirationService.expireStaleBookings.mockImplementation(async () => {
        callOrder.push('expire');
        return 2;
      });
      paymentAbandonmentService.expireStalePayments.mockImplementation(async () => {
        callOrder.push('abandon');
        return 1;
      });
      seatReleaseService.releaseExpiredHolds.mockImplementation(async () => {
        callOrder.push('holds');
        return 0;
      });

      await service.runBookingMaintenance();

      expect(callOrder).toEqual(['expire', 'abandon', 'holds']);
    });

    it('logs counts only when maintenance work was performed', async () => {
      bookingExpirationService.expireStaleBookings.mockResolvedValue(3);
      paymentAbandonmentService.expireStalePayments.mockResolvedValue(2);

      await service.runBookingMaintenance();

      expect(logger.log).toHaveBeenCalledWith('Expired 3 bookings');
      expect(logger.log).toHaveBeenCalledWith('Abandoned 2 stale payment sessions');
    });

    it('still releases holds when no bookings or payments expired', async () => {
      await service.runBookingMaintenance();

      expect(bookingExpirationService.expireStaleBookings).toHaveBeenCalled();
      expect(paymentAbandonmentService.expireStalePayments).toHaveBeenCalled();
      expect(seatReleaseService.releaseExpiredHolds).toHaveBeenCalled();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('logs and swallows errors from booking expiration', async () => {
      const error = new Error('expire failed');
      bookingExpirationService.expireStaleBookings.mockRejectedValue(error);

      await expect(service.runBookingMaintenance()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(error, 'Booking maintenance failed');
      expect(paymentAbandonmentService.expireStalePayments).not.toHaveBeenCalled();
      expect(seatReleaseService.releaseExpiredHolds).not.toHaveBeenCalled();
    });

    it('logs and swallows errors from payment abandonment', async () => {
      const error = new Error('abandon failed');
      paymentAbandonmentService.expireStalePayments.mockRejectedValue(error);

      await expect(service.runBookingMaintenance()).resolves.toBeUndefined();

      expect(bookingExpirationService.expireStaleBookings).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(error, 'Booking maintenance failed');
      expect(seatReleaseService.releaseExpiredHolds).not.toHaveBeenCalled();
    });
  });

  describe('refreshFxRates', () => {
    it('refreshes rates and logs success', async () => {
      await service.refreshFxRates();

      expect(currencyRatesService.refreshRates).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith('FX rates refreshed');
    });

    it('logs and swallows refresh errors', async () => {
      const error = new Error('fx failed');
      currencyRatesService.refreshRates.mockRejectedValue(error);

      await expect(service.refreshFxRates()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(error, 'FX rates refresh failed');
    });
  });
});
