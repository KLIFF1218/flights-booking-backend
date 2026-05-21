export interface FlightPricingResponse {
  id: string;

  price: FlightPrice;

  travelers: FlightTraveler[];

  outbound: FlightDirection;
  inbound?: FlightDirection;
}

export interface FlightPrice {
  base: number;
  seats: number;
  total: number;
  currency: string;

  baggage?: number;
  meals?: number;
  otherServices?: number;
}

export interface FlightTraveler {
  travelerId: string;
  travelerType: TravelerType;
}

export enum TravelerType {
  ADULT = 'ADULT',
  CHILD = 'CHILD',
  INFANT = 'HELD_INFANT',
  INFANT_SEATED = 'SEATED_INFANT',
}

export interface FlightDirection {
  from: string;
  to: string;

  departureTime: string;
  arrivalTime: string;

  durationMinutes: number;
  stops: number;

  segments: FlightSegment[];
}

export interface FlightSegment {
  segmentId: string;

  from: string;
  to: string;

  departureTime: string;
  arrivalTime: string;

  airline: string;
  flightNumber: string;
}
