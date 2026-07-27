import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import { BookingsCacheService } from '../services/bookings-cache.service';

export type CheckoutCleanupOutboxPayload = {
  bookingId: string;
  userId: string;
  searchId: string;
  offerId: string;
};

@Injectable()
export class CheckoutCleanupOutboxHandler {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingsCache: BookingsCacheService,
    private readonly logger: Logger,
  ) {}

  async handle(payload: CheckoutCleanupOutboxPayload): Promise<void> {
    this.logger.debug(
      { bookingId: payload.bookingId, searchId: payload.searchId, offerId: payload.offerId },
      'Running checkout cleanup outbox handler',
    );

    await this.searchStore.deleteSeatMap(payload.searchId, payload.offerId);
    await this.bookingsCache.invalidateBooking(payload.bookingId, payload.userId);
  }
}
