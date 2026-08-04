import { Module } from '@nestjs/common';
import { PaymentAbandonmentModule } from 'src/modules/payment/payment-abandonment.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { TicketingFailedOutboxHandler } from './handlers/ticketing-failed.outbox-handler';

@Module({
  imports: [PaymentAbandonmentModule, BookingMetricsModule],
  providers: [TicketingFailedOutboxHandler],
  exports: [TicketingFailedOutboxHandler],
})
export class TicketingOutboxHandlersModule {}
