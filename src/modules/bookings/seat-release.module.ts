import { Module } from '@nestjs/common';
import { SeatReleaseService } from './services/seat-release.service';
import { BookingMetricsModule } from './metrics/booking-metrics.module';

@Module({
  imports: [BookingMetricsModule],
  providers: [SeatReleaseService],
  exports: [SeatReleaseService],
})
export class SeatReleaseModule {}
