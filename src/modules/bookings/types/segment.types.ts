export interface BuiltSegment {
  id: string;
  flightInstanceId: string;

  departure: {
    iataCode: string;
    at: string;
  };

  arrival: {
    iataCode: string;
    at: string;
  };

  carrierCode: string;
  number: string;

  aircraft: {
    code: string | null;
  };

  operating: {
    carrierCode: string;
  };

  duration: string;

  blacklistedInEU: boolean;
}
