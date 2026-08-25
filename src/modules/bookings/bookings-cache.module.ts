import { Module } from '@nestjs/common';
import { RedisModule } from 'src/infra/redis/redis.module';
import { BookingsCacheService } from './services/lifecycle/bookings-cache.service';
import { BookingMetricsModule } from './metrics/booking-metrics.module';

@Module({
  imports: [RedisModule, BookingMetricsModule],
  providers: [BookingsCacheService],
  exports: [BookingsCacheService],
})
export class BookingsCacheModule {}
