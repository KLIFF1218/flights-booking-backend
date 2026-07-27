/**
 * Legacy OTA-shaped pricing cache payload used by FlightsSearchStore.
 * Runtime pricing is produced by DbPricingProvider from PostgreSQL inventory.
 */
export interface FlightOffersPricingResponse {
  data: FlightOffersPricingData;
  dictionaries?: Dictionaries;
}

export interface FlightOffersPricingData {
  type: 'flight-offers-pricing';
  flightOffers: FlightOfferPricing[];
  bookingRequirements: BookingRequirements;
}

export interface FlightOfferPricing {
  type: 'flight-offer';
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  paymentCardRequired: boolean;
  lastTicketingDate: string;
  itineraries: Itinerary[];
  price: PriceWithBilling;
  pricingOptions: PricingOptions;
  validatingAirlineCodes: string[];
  travelerPricings: TravelerPricingPricing[];
}

export interface Itinerary {
  segments: Segment[];
}

export interface Segment {
  id: string;
  departure: AirportPoint;
  arrival: AirportPoint;
  carrierCode: string;
  number: string;
  aircraft: Aircraft;
  operating: Operating;
  duration: string;
  numberOfStops: number;
  co2Emissions?: Co2Emission[];
}

export interface AirportPoint {
  iataCode: string;
  terminal?: string;
  at: string;
}

export interface Aircraft {
  code: string;
}

export interface Operating {
  carrierCode: string;
}

export interface Co2Emission {
  weight: number;
  weightUnit: string;
  cabin: string;
}

export interface PriceWithBilling {
  currency: string;
  total: string;
  base: string;
  grandTotal: string;
  billingCurrency: string;
  fees?: Fee[];
  additionalServices?: AdditionalService[];
}

export interface AdditionalService {
  amount: string;
  type: string;
}
export interface Fee {
  amount: string;
  type: string;
}

export interface PricingOptions {
  fareType: string[];
  includedCheckedBagsOnly: boolean;
}

export interface TravelerPricingPricing {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: TravelerPricePricing;
  fareDetailsBySegment: FareDetailsBySegmentPricing[];
}

export interface TravelerPricePricing {
  currency: string;
  total: string;
  base: string;
  refundableTaxes?: string;
  taxes?: Tax[];
}

export interface Tax {
  amount: string;
  code: string;
}

export interface FareDetailsBySegmentPricing {
  segmentId: string;
  cabin: string;
  fareBasis: string;
  brandedFare: string;
  class: string;
  includedCheckedBags?: {
    quantity: number;
  };
}

export interface BookingRequirements {
  emailAddressRequired: boolean;
  mobilePhoneNumberRequired: boolean;
  travelerRequirements: TravelerRequirement[];
}

export interface TravelerRequirement {
  travelerId: string;
  genderRequired: boolean;
  documentRequired: boolean;
  dateOfBirthRequired: boolean;
  redressRequiredIfAny: boolean;
  residenceRequired: boolean;
}

export interface Dictionaries {
  locations: Record<string, LocationDictionaryItem>;
}

export interface LocationDictionaryItem {
  cityCode: string;
  countryCode: string;
}
