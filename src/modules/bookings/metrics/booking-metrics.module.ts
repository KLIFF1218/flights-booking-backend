import { Global, Module } from '@nestjs/common';
import { BookingMetricsService } from './booking-metrics.service';

@Global()
@Module({
  providers: [BookingMetricsService],
  exports: [BookingMetricsService],
})
export class BookingMetricsModule {}
