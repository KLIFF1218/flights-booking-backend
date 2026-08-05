import { Module } from '@nestjs/common';
import { BookingPaymentLifecycleService } from 'src/modules/bookings/services/booking-payment-lifecycle.service';
import { SeatReleaseModule } from 'src/modules/bookings/seat-release.module';
import { BookingsCacheModule } from 'src/modules/bookings/bookings-cache.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { OutboxE2eModule } from './outbox-e2e.module';

/** Booking payment side effects with slim outbox (no Kafka/Rabbit processors). */
@Module({
  imports: [OutboxE2eModule, SeatReleaseModule, BookingsCacheModule, BookingMetricsModule],
  providers: [BookingPaymentLifecycleService],
  exports: [BookingPaymentLifecycleService],
})
export class BookingPaymentLifecycleE2eModule {}
