import { Module } from '@nestjs/common';
import { SeatmapsController } from './controllers/seatmap.controller';
import { SeatMapsService } from './services/seatmap.service';
import { FlightsModule } from '../flights/flights.module';
import { MockSeatMapService } from './services/MockSeatMapService';
import { MetricsModule } from '../../infra/metrics/metrics.module';

@Module({
  imports: [FlightsModule, MetricsModule],
  controllers: [SeatmapsController],
  providers: [SeatMapsService, MockSeatMapService],
})
export class SeatMapModule {}
