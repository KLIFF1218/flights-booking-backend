import { Module, forwardRef } from '@nestjs/common';
import { BookingsService } from './services/booking/bookings.service';
import { BookingTicketController } from './controllers/booking-ticket.controller';
import { PaymentsModule } from '../payment/payment.module';
import { FlightBookingController } from './controllers/flight-booking.controller';
import { BookingWorkflowService } from './services/booking/booking-workflow.service';
import { FlightsModule } from '../flights/flights.module';
import { BookingCreationService } from './services/booking/booking-creation.service';
import { S3Module } from 'src/infra/storage/s3.module';
import { BookingsCacheModule } from './bookings-cache.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { SeatReleaseModule } from './seat-release.module';
import { BookingExpirationModule } from './booking-expiration.module';
import { SeatMapModule } from '../seatmaps/seatmap.module';
import { BookingCheckoutService } from './services/checkout/booking-checkout.service';
import { BookingPaymentService } from './services/checkout/booking-payment.service';
import { BookingSeatService } from './services/seats/booking-seat.service';
import { BookingTravelerService } from './services/tickets/booking-traveler.service';
import { BookingMetricsModule } from './metrics/booking-metrics.module';
import { BookingTicketService } from './services/tickets/booking-ticket.service';
import { BookingIdempotencyService } from './services/booking/booking-idempotency.service';

@Module({
  imports: [
    BookingMetricsModule,
    PaymentsModule,
    FlightsModule,
    S3Module,
    BookingsCacheModule,
    forwardRef(() => OutboxModule),
    SeatReleaseModule,
    BookingExpirationModule,
    SeatMapModule,
  ],
  controllers: [FlightBookingController, BookingTicketController],
  providers: [
    BookingsService,
    BookingWorkflowService,
    BookingCreationService,
    BookingCheckoutService,
    BookingPaymentService,
    BookingSeatService,
    BookingTravelerService,
    BookingTicketService,
    BookingIdempotencyService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
