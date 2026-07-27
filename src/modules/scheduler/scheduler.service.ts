import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { SeatReleaseService } from '../bookings/services/seat-release.service';
import { BookingExpirationService } from '../bookings/services/booking-expiration.service';
import { PaymentAbandonmentService } from '../payment/services/payment-abandonment.service';
import { CurrencyRatesService } from '../flights/services/currency-rates.service';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runBookingMaintenance() {
    try {
      const expired = await this.bookingExpirationService.expireStaleBookings();

      if (expired > 0) {
        this.logger.log(`Expired ${expired} bookings`);
      }

      const abandonedPayments = await this.paymentAbandonmentService.expireStalePayments();

      if (abandonedPayments > 0) {
        this.logger.log(`Abandoned ${abandonedPayments} stale payment sessions`);
      }

      // Runs after expiration so active bookings only get hold TTL resync, not seat release.
      await this.seatReleaseService.releaseExpiredHolds();
    } catch (error) {
      this.logger.error(error, 'Booking maintenance failed');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshFxRates() {
    try {
      await this.currencyRatesService.refreshRates();
      this.logger.log('FX rates refreshed');
    } catch (error) {
      this.logger.error(error, 'FX rates refresh failed');
    }
  }
}
