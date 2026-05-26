import type {
  FlightOffersResponse,
  FlightSearchParams,
} from '../interfaces/flight-offers.interface';

export const FLIGHT_SEARCH_PROVIDER = 'FLIGHT_SEARCH_PROVIDER';

export interface FlightSearchProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightOffersResponse>;
}
