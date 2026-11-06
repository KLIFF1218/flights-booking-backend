import { Module, forwardRef } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module';
import { BookingsCacheModule } from './bookings-cache.module';
import { BookingsModule } from './bookings.module';
import { CheckoutCleanupOutboxHandler } from './handlers/checkout-cleanup.outbox-handler';
import { CreateCompensationOutboxHandler } from './handlers/create-compensation.outbox-handler';

@Module({
  imports: [FlightsModule, BookingsCacheModule, forwardRef(() => BookingsModule)],
  providers: [CheckoutCleanupOutboxHandler, CreateCompensationOutboxHandler],
  exports: [CheckoutCleanupOutboxHandler, CreateCompensationOutboxHandler],
})
export class BookingsOutboxHandlersModule {}
