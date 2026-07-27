import { Module } from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminBookingsController } from './admin-bookings.controller';
import { DomainEventsModule } from 'src/infra/domain-events/domain-events.module';

@Module({
  imports: [DomainEventsModule],
  controllers: [AdminBookingsController],
  providers: [AdminBookingsService],
})
export class AdminBookingsModule {}
