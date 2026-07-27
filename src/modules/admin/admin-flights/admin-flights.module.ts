import { Module } from '@nestjs/common';
import { AdminFlightsController } from './admin-flights.controller';
import { FlightsService } from './admin-flights.service';
import { FlightsModule } from 'src/modules/flights/flights.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';

@Module({
  imports: [FlightsModule, OutboxModule],
  controllers: [AdminFlightsController],
  providers: [FlightsService],
})
export class AdminFlightsModule {}
