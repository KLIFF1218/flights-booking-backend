import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PaymentAbandonmentService } from 'src/modules/payment/services/payment-abandonment.service';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';

export type TicketingFailedOutboxPayload = {
  bookingId: string;
  reason: string;
  userId: string;
};

@Injectable()
export class TicketingFailedOutboxHandler {
  constructor(
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly logger: Logger,
  ) {}

  async handle(payload: TicketingFailedOutboxPayload): Promise<void> {
    this.logger.error(
      { bookingId: payload.bookingId, reason: payload.reason, userId: payload.userId },
      'Processing ticketing failure compensation workflow',
    );

    await this.paymentAbandonmentService.compensateTicketingFailure(
      payload.bookingId,
      payload.reason,
    );
    this.bookingMetrics.recordTicketingFailureEscalated(payload.reason);
  }
}
