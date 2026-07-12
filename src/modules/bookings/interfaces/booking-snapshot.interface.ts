import type { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';
import type { FlightPricingResponse } from 'src/modules/flights/dtos';

export interface BookingSnapshot {
  offer: FlightOffer;
  pricing: FlightPricingResponse;
}
