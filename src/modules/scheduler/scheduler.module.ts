import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SeatReleaseModule } from '../bookings/seat-release.module';
import { BookingExpirationModule } from '../bookings/booking-expiration.module';
import { PaymentsModule } from '../payment/payment.module';
import { FlightsModule } from '../flights/flights.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SeatReleaseModule,
    BookingExpirationModule,
    PaymentsModule,
    FlightsModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
