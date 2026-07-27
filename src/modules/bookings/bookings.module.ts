import { Module, forwardRef } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingTicketController } from './controllers/booking-ticket.controller';
import { PaymentsModule } from '../payment/payment.module';
import { FlightBookingController } from './controllers/flight-booking.controller';
import { BookingWorkflowService } from './services/booking-workflow.service';
import { FlightsModule } from '../flights/flights.module';
import { BookingCreationService } from './services/booking-creation.service';
import { S3Module } from 'src/infra/storage/s3.module';
import { BookingsCacheModule } from './bookings-cache.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { SeatReleaseModule } from './seat-release.module';
import { BookingExpirationModule } from './booking-expiration.module';
import { SeatMapModule } from '../seatmaps/seatmap.module';
import { BookingCheckoutService } from './services/booking-checkout.service';
import { BookingPaymentService } from './services/booking-payment.service';
import { BookingSeatService } from './services/booking-seat.service';
import { BookingTravelerService } from './services/booking-traveler.service';
import { BookingMetricsModule } from './metrics/booking-metrics.module';
import { BookingTicketService } from './services/booking-ticket.service';
import { BookingIdempotencyService } from './services/booking-idempotency.service';
import { CheckoutCleanupOutboxHandler } from './handlers/checkout-cleanup.outbox-handler';
import { TicketingFailedOutboxHandler } from './handlers/ticketing-failed.outbox-handler';
import { CreateCompensationOutboxHandler } from './handlers/create-compensation.outbox-handler';

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
    CheckoutCleanupOutboxHandler,
    TicketingFailedOutboxHandler,
    CreateCompensationOutboxHandler,
  ],
  exports: [
    CheckoutCleanupOutboxHandler,
    TicketingFailedOutboxHandler,
    CreateCompensationOutboxHandler,
  ],
})
export class BookingsModule {}
