import { BadRequestException } from '@nestjs/common';
import type { FlightDirection } from '../interfaces/flight-offers.interface';
import { resolveAirportTimezone } from './airport-timezone.util';
import { formatDateInTimeZone } from './timezone-date.util';

export const IATA_CODE_PATTERN = /^[A-Z]{3}$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeAirport(code: string): string {
  return code.trim().toUpperCase();
}

export function normalizeIataCode(code: string): string {
  return normalizeAirport(code);
}

export function isValidIataCode(code: string): boolean {
  return IATA_CODE_PATTERN.test(normalizeAirport(code));
}

export function isDistinctOriginDestination(origin: string, destination: string): boolean {
  return normalizeAirport(origin) !== normalizeAirport(destination);
}

export function isIsoDateString(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function formatUtcIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Flight search dates are local operating days at the origin airport.
 * "Today" must use that airport timezone, not the server/UTC calendar day.
 */
export function isTodayOrFutureIsoDate(
  value: string,
  referenceDate = new Date(),
  timeZone = 'UTC',
): boolean {
  if (!isIsoDateString(value)) {
    return false;
  }

  return value >= formatDateInTimeZone(referenceDate, timeZone);
}

export function isRoundTripRouteValid(
  outbound: Pick<FlightDirection, 'origin' | 'destination'>,
  inbound: Pick<FlightDirection, 'origin' | 'destination'>,
): boolean {
  if (
    !isValidIataCode(outbound.origin) ||
    !isValidIataCode(outbound.destination) ||
    !isValidIataCode(inbound.origin) ||
    !isValidIataCode(inbound.destination)
  ) {
    return false;
  }

  if (
    !isDistinctOriginDestination(outbound.origin, outbound.destination) ||
    !isDistinctOriginDestination(inbound.origin, inbound.destination)
  ) {
    return false;
  }

  return (
    normalizeAirport(inbound.origin) === normalizeAirport(outbound.destination) &&
    normalizeAirport(inbound.destination) === normalizeAirport(outbound.origin)
  );
}

export function isReturnDateValid(
  outbound: Pick<FlightDirection, 'dateFrom'>,
  inbound: Pick<FlightDirection, 'dateFrom'>,
): boolean {
  if (!isIsoDateString(outbound.dateFrom) || !isIsoDateString(inbound.dateFrom)) {
    return false;
  }

  return inbound.dateFrom >= outbound.dateFrom;
}

function assertValidDirection(direction: FlightDirection): void {
  if (!isValidIataCode(direction.origin)) {
    throw new BadRequestException('origin must be a valid IATA code');
  }

  if (!isValidIataCode(direction.destination)) {
    throw new BadRequestException('destination must be a valid IATA code');
  }

  if (!isDistinctOriginDestination(direction.origin, direction.destination)) {
    throw new BadRequestException('origin and destination must be different');
  }

  if (!isIsoDateString(direction.dateFrom)) {
    throw new BadRequestException('dateFrom must be a valid ISO date (YYYY-MM-DD)');
  }

  const originTimeZone = resolveAirportTimezone(direction.origin);

  if (!isTodayOrFutureIsoDate(direction.dateFrom, new Date(), originTimeZone)) {
    throw new BadRequestException(
      'dateFrom must be today or in the future in the origin airport timezone',
    );
  }
}

export function assertValidSearchDirections(directions: FlightDirection[]): void {
  if (!directions.length) {
    throw new BadRequestException('At least one direction is required');
  }

  if (directions.length > 2) {
    throw new BadRequestException('Only one-way and round-trip searches are supported');
  }

  for (const direction of directions) {
    assertValidDirection(direction);
  }

  if (directions.length === 2) {
    assertValidRoundTripDirections(directions[0], directions[1]);
  }
}

export function assertValidRoundTripDirections(
  outbound: FlightDirection,
  inbound: FlightDirection,
): void {
  if (!isRoundTripRouteValid(outbound, inbound)) {
    throw new BadRequestException(
      'Round-trip return must reverse outbound route (return origin/destination must match outbound destination/origin)',
    );
  }

  if (!isReturnDateValid(outbound, inbound)) {
    throw new BadRequestException('Return date must be on or after outbound date');
  }
}
