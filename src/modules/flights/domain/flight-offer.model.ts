export interface FlightOffer {
  id: string;
  totalPrice: number;
  currency: string;
  seatsAvailable: number;
  routes: FlightRoute[];
}

export interface FlightRoute {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
}
