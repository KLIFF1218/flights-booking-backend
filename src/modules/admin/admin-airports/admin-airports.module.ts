import { Module } from '@nestjs/common';
import { AdminAirportsService } from './admin-airports.service';
import { AdminAirportsController } from './admin-airports.controller';

@Module({
  controllers: [AdminAirportsController],
  providers: [AdminAirportsService],
})
export class AdminAirportsModule {}
