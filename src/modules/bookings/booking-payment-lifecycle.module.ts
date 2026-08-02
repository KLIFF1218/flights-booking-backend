import { Module } from '@nestjs/common';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { SeatReleaseModule } from './seat-release.module';
import { BookingsCacheModule } from './bookings-cache.module';
import { BookingMetricsModule } from './metrics/booking-metrics.module';
import { BookingPaymentLifecycleService } from './services/booking-payment-lifecycle.service';

@Module({
  imports: [OutboxModule, SeatReleaseModule, BookingsCacheModule, BookingMetricsModule],
  providers: [BookingPaymentLifecycleService],
  exports: [BookingPaymentLifecycleService],
})
export class BookingPaymentLifecycleModule {}
