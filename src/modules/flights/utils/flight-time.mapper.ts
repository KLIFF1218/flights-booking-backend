import { toFlightLocalTime } from './flight-local-time.util';

export type FlightTimeDto = {
  at: string;
  airport: string;
  localDate: string;
  localTime: string;
  timezone: string;
};

export function toFlightTimeDto(
  at: string,
  airportIata: string,
  timezone?: string | null,
): FlightTimeDto {
  const local = toFlightLocalTime(at, airportIata, timezone ?? undefined);

  return {
    at,
    airport: airportIata,
    localDate: local.localDate,
    localTime: local.localTime,
    timezone: local.timezone,
  };
}

export function toSegmentEndpointDto(
  at: string,
  airportIata: string,
  timezone?: string | null,
): {
  iataCode: string;
  at: string;
  localDate: string;
  localTime: string;
  timezone: string;
} {
  const flightTime = toFlightTimeDto(at, airportIata, timezone);

  return {
    iataCode: flightTime.airport,
    at: flightTime.at,
    localDate: flightTime.localDate,
    localTime: flightTime.localTime,
    timezone: flightTime.timezone,
  };
}
