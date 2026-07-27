import { Inject, Injectable } from '@nestjs/common';
import {
  FLIGHT_PRICING_PROVIDER,
  type FlightPricingOptions,
  type FlightPricingProvider,
} from '../providers/flight-pricing.provider';

@Injectable()
export class FlightsPricingService {
  constructor(
    @Inject(FLIGHT_PRICING_PROVIDER)
    private readonly pricingProvider: FlightPricingProvider,
  ) {}

  async price(searchId: string, offerId: string, options?: FlightPricingOptions) {
    return this.pricingProvider.price(searchId, offerId, options);
  }
}
