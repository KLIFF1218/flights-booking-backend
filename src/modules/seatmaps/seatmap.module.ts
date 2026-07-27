import { Module } from '@nestjs/common';
import { SeatmapsController } from './controllers/seatmap.controller';
import { SeatMapsService } from './services/seatmap.service';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [FlightsModule],
  controllers: [SeatmapsController],
  providers: [SeatMapsService],
  exports: [SeatMapsService],
})
export class SeatMapModule {}
