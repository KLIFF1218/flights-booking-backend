import { Module } from '@nestjs/common';
import { BookingExpirationService } from 'src/modules/bookings/services/booking-expiration.service';
import { SeatReleaseModule } from 'src/modules/bookings/seat-release.module';
import { BookingsCacheModule } from 'src/modules/bookings/bookings-cache.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { OutboxE2eModule } from './outbox-e2e.module';

@Module({
  imports: [SeatReleaseModule, BookingsCacheModule, BookingMetricsModule, OutboxE2eModule],
  providers: [BookingExpirationService],
  exports: [BookingExpirationService],
})
export class BookingExpirationE2eModule {}
