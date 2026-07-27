import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { BookingsService } from '../services/bookings.service';

export type CreateCompensationOutboxPayload = {
  bookingId: string;
  userId: string;
};

@Injectable()
export class CreateCompensationOutboxHandler {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly logger: Logger,
  ) {}

  async handle(payload: CreateCompensationOutboxPayload): Promise<void> {
    this.logger.warn(
      { bookingId: payload.bookingId, userId: payload.userId },
      'Retrying create workflow compensation via outbox',
    );

    await this.bookingsService.compensateFailedCreateBooking(payload.bookingId, payload.userId);
  }
}
