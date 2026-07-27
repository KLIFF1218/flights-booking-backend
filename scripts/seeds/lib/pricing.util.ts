import { AIRPORT_COORDINATES, type AirportCoord } from '../config/airport-coordinates';

const MIN_FARE_USD = 45;
const PRICE_PER_KM_USD = 0.07;

const AIRLINE_MULTIPLIERS: Record<string, number> = {
  DL: 1.0,
  AA: 1.05,
  UA: 0.95,
  SU: 0.92,
  TK: 1.08,
  LH: 1.12,
  AF: 1.1,
  BA: 1.15,
  KL: 1.06,
  EK: 1.2,
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(from: AirportCoord, to: AirportCoord): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeDistanceBasePriceUsd(fromIata: string, toIata: string): number {
  const from = AIRPORT_COORDINATES[fromIata];
  const to = AIRPORT_COORDINATES[toIata];

  if (!from || !to) {
    throw new Error(`Missing airport coordinates for ${fromIata} or ${toIata}`);
  }

  const distanceKm = haversineDistanceKm(from, to);
  return MIN_FARE_USD + distanceKm * PRICE_PER_KM_USD;
}

export function getAirlineMultiplier(airlineCode: string): number {
  return AIRLINE_MULTIPLIERS[airlineCode] ?? 1;
}

export function getTimeOfDayMultiplier(departureTime: string): number {
  const hour = Number(departureTime.split(':')[0]);

  if (hour < 6) {
    return 0.85;
  }

  if (hour < 9) {
    return 1.15;
  }

  if (hour < 15) {
    return 1;
  }

  if (hour < 17) {
    return 1.05;
  }

  if (hour < 21) {
    return 1.18;
  }

  return 0.92;
}

export function getBookingWindowMultiplier(dayOffset: number): number {
  if (dayOffset <= 2) {
    return 1.35;
  }

  if (dayOffset <= 7) {
    return 1.15;
  }

  if (dayOffset <= 14) {
    return 1;
  }

  if (dayOffset <= 21) {
    return 0.92;
  }

  return 0.85;
}

export function computeFlightTemplatePriceUsd(
  fromIata: string,
  toIata: string,
  airlineCode: string,
  departureTime: string,
): number {
  const distanceBase = computeDistanceBasePriceUsd(fromIata, toIata);
  const price =
    distanceBase * getAirlineMultiplier(airlineCode) * getTimeOfDayMultiplier(departureTime);

  return +price.toFixed(2);
}

export function computeInstancePriceUsd(templatePriceUsd: number, dayOffset: number): number {
  return +(templatePriceUsd * getBookingWindowMultiplier(dayOffset)).toFixed(2);
}
