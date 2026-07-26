export interface BuiltSegment {
  id: string;
  flightInstanceId: string;

  from: string;
  to: string;

  departure: {
    iataCode: string;
    at: string;
    localDate?: string;
    localTime?: string;
    timezone?: string;
  };

  arrival: {
    iataCode: string;
    at: string;
    localDate?: string;
    localTime?: string;
    timezone?: string;
  };

  carrierCode: string;
  number: string;

  airline: string;
  airlineIata: string;

  aircraft: string | null;

  operating: {
    carrierCode: string;
  };

  duration: string;

  blacklistedInEU: boolean;
}
