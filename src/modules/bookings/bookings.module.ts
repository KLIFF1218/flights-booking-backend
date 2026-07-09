import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingTicketController } from './controllers/booking.ticket.controller';
import { PaymentsModule } from '../payment/payment.module';
import { FlightBookingController } from './controllers/flight.booking.controller';
import { FlightBookingService } from './services/flight.booking.service';
import { FlightsModule } from '../flights/flights.module';
import { MockBookingService } from './services/mock-booking.service';
import { S3Module } from 'src/infra/storage/s3.module';
import { BookingsCacheService } from './services/bookings-cache.service';
import { RedisModule } from 'src/infra/redis/redis.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';

@Module({
  imports: [PaymentsModule, FlightsModule, S3Module, RedisModule, OutboxModule],
  controllers: [FlightBookingController, BookingTicketController],
  providers: [BookingsService, FlightBookingService, MockBookingService, BookingsCacheService],
})
export class BookingsModule {}
