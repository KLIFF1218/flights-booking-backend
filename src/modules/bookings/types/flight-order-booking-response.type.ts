export interface FlightOrderSnapshot {
  data: FlightOrderData;
  dictionaries?: unknown;
}

export interface FlightOrderData {
  type: 'flight-order';
  id: string;
  queuingOfficeId?: string;

  associatedRecords?: AssociatedRecord[];
  flightOffers?: FlightOffer[];

  travelers?: unknown[];
  ticketingAgreement?: unknown;
  automatedProcess?: unknown[];
}

export interface AssociatedRecord {
  reference: string;
  creationDate?: string;
  originSystemCode?: string;
  flightOfferId?: string;
}

export interface FlightOffer {
  id: string;
  source?: string;
  lastTicketingDate: string;
  itineraries?: unknown[];
  price?: FlightPrice;
  travelerPricings?: TravelerPricing[];
}

export interface FlightPrice {
  currency?: string;
  total?: string;
  base?: string;
  grandTotal?: string;
  billingCurrency?: string;
}

export interface TravelerPricing {
  travelerType?: string;
  price?: {
    currency?: string;
    total?: string;
    base?: string;
  };
  fareDetailsBySegment?: FareDetailsBySegment[];
}

export interface FareDetailsBySegment {
  cabin?: string;
  fareBasis?: string;
}
