import type { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';
import type { FlightPricingResponse } from 'src/modules/flights/dtos';
import type { PaymentProvider } from '@prisma/client';

export interface BookingSnapshot {
  offer: FlightOffer;
  pricing: FlightPricingResponse;
  searchId?: string;
  offerId?: string;
  paymentProvider?: PaymentProvider;
  /** Resolved at booking creation; avoids Redis seatmap cache misses during checkout. */
  seatSelectionRequired?: boolean;
}
