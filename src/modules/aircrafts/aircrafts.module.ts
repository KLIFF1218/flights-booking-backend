import { Module } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { AircraftsController } from './controllers/aircrafts.controller';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService],
})
export class AircraftsModule {}
