import type { FlightPricingResponse } from '../dtos/flight-pricing.response.dto';
import type { SeatOptionDto } from '../dtos/flight-pricing.request.dto';

export const FLIGHT_PRICING_PROVIDER = 'FLIGHT_PRICING_PROVIDER';

export type FlightPricingOptions = {
  seats?: SeatOptionDto[];
  adults?: number;
  children?: number;
  infants?: number;
  seatedInfants?: number;
  lockedFxRates?: Record<string, number>;
  fareBrand?: 'LIGHT' | 'FLEX';
  /** When repricing assigned seats during checkout, ignore holds owned by this booking. */
  bookingId?: string;
};

export interface FlightPricingProvider {
  price(
    searchId: string,
    offerId: string,
    options?: FlightPricingOptions,
  ): Promise<FlightPricingResponse>;
}
