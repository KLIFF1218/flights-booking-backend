import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { FxRatesSchedulerService } from './fx-rates-scheduler.service';
import { SchedulerLockService } from './scheduler-lock.service';
import { SchedulerMetricsService } from './scheduler-metrics.service';
import { SeatReleaseModule } from '../bookings/seat-release.module';
import { BookingExpirationModule } from '../bookings/booking-expiration.module';
import { PaymentAbandonmentModule } from '../payment/payment-abandonment.module';
import { PaymentOrphanReconciliationModule } from '../payment/payment-orphan-reconciliation.module';
import { FlightsModule } from '../flights/flights.module';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
  imports: [
    SeatReleaseModule,
    BookingExpirationModule,
    PaymentAbandonmentModule,
    PaymentOrphanReconciliationModule,
    FlightsModule,
    RedisModule,
  ],
  providers: [
    SchedulerService,
    FxRatesSchedulerService,
    SchedulerLockService,
    SchedulerMetricsService,
  ],
})
export class SchedulerModule {}
