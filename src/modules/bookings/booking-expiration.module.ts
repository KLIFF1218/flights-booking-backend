import { Module, forwardRef } from '@nestjs/common';
import { BookingExpirationService } from './services/lifecycle/booking-expiration.service';
import { SeatReleaseModule } from './seat-release.module';
import { BookingsCacheModule } from './bookings-cache.module';
import { BookingMetricsModule } from './metrics/booking-metrics.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';

@Module({
  imports: [
    SeatReleaseModule,
    BookingsCacheModule,
    BookingMetricsModule,
    forwardRef(() => OutboxModule),
  ],
  providers: [BookingExpirationService],
  exports: [BookingExpirationService],
})
export class BookingExpirationModule {}
