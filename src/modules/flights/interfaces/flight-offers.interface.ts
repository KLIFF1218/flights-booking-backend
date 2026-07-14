import type { Currency, PassengerType } from '@prisma/client';
import type { BuiltSegment } from 'src/modules/bookings/types/segment.types';

export type TravelClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

export interface FlightDirection {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo?: string;
}

export interface PassengerCounts {
  adults: number;
  children?: number;
  infants?: number;
}

export interface FlightSearchParams {
  directions: FlightDirection[];
  passengers: PassengerCounts;
  travelClass: TravelClass;
  currencyCode?: Currency;
  limit?: number;
}

export interface FlightOffersMeta {
  count: number;
}

export interface FlightOffersResponse {
  meta: FlightOffersMeta;
  data: FlightOffer[];
}

export interface FlightOfferCard {
  offerId: string;
  price: {
    total: string;
    currency: string;
  };
  routes: Array<{
    from: string;
    to: string;
    departure: { airport: string; time: string };
    arrival: { airport: string; time: string };
    durationMinutes: number;
    stops: number;
    segments: Array<{
      from: string;
      to: string;
      departureTime: string;
      arrivalTime: string;
      airline: string;
      flightNumber: string;
      durationMinutes: number;
    }>;
  }>;
  totalDurationMinutes: number;
}

export interface FlightOffer {
  id: string;
  numberOfBookableSeats: number;
  price: {
    total: string;
    currency: Currency;
    base?: string;
    grandTotal?: string;
    fees?: any[];
  };

  itineraries: Itinerary[];

  oneWay?: boolean;
  lastTicketingDate?: string;
  source?: string;
  instantTicketingRequired?: boolean;
  nonHomogeneous?: boolean;
  type?: string;

  travelerPricings?: TravelerPricing[];
}

export interface Itinerary {
  duration: string;
  segments: BuiltSegment[];
}

export interface Segment {
  id: string;
  number: string;
  carrierCode: string;
  carrierName?: string;
  flightInstanceId?: string;

  aircraft?: {
    code: string | null;
  };

  departure: {
    iataCode: string;
    at: string;
  };

  arrival: {
    iataCode: string;
    at: string;
  };

  duration: string;
}

export interface TravelerPricing {
  travelerId: string;
  travelerType: PassengerType;

  fareOption?: string;

  price: {
    currency: Currency;
    total: string;
    base: string;
  };

  fareDetailsBySegment: FareDetailsBySegment[];
}

export interface FareDetailsBySegment {
  segmentId: string;

  cabin: TravelClass;

  class?: string;

  fareBasis: string | null;

  includedCheckedBags: {
    quantity: number;
  };

  brandName: string | null;
}
