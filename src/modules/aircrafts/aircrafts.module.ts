import { Module } from '@nestjs/common';
import { AircraftsService } from './services/aircrafts.service';
import { AircraftsController } from './controllers/aircrafts.controller';

@Module({
  controllers: [AircraftsController],
  providers: [AircraftsService],
})
export class AircraftsModule {}
