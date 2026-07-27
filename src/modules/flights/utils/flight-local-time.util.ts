import { resolveAirportTimezone } from './airport-timezone.util';
import { formatDateInTimeZone, formatTimeInTimeZone } from './timezone-date.util';

export type FlightLocalTimeFields = {
  localDate: string;
  localTime: string;
  timezone: string;
};

export function toFlightLocalTime(
  iso: string,
  airportIata: string,
  timezone?: string | null,
): FlightLocalTimeFields {
  const resolvedTimezone = timezone ?? resolveAirportTimezone(airportIata);
  const instant = new Date(iso);

  return {
    localDate: formatDateInTimeZone(instant, resolvedTimezone),
    localTime: formatTimeInTimeZone(instant, resolvedTimezone),
    timezone: resolvedTimezone,
  };
}

export function enrichEndpointLocalTime(
  iso: string,
  airportIata: string,
  timezone?: string | null,
): FlightLocalTimeFields {
  return toFlightLocalTime(iso, airportIata, timezone);
}
