import { Module } from '@nestjs/common';
import { SchedulerService } from './services/scheduler.service';
import { FxRatesSchedulerService } from './services/fx-rates-scheduler.service';
import { SchedulerLockService } from './services/scheduler-lock.service';
import { SchedulerMetricsService } from './services/scheduler-metrics.service';
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
