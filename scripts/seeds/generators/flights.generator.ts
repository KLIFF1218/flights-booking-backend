import type { RouteSeedConfig } from '../config/routes.config';
import { SEED_DAYS } from '../config/routes.config';
import { computeFlightTemplatePriceUsd } from '../lib/pricing.util';

export type GeneratedFlight = {
  airlineCode: string;
  flightNumber: string;
  from: string;
  to: string;
  durationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  aircraftCode: string;
  basePriceUsd: number;
  days: number;
};

const AIRCRAFT_BY_AIRLINE: Record<string, string> = {
  SU: 'SU-A359',
  TK: 'TK-B789',
  LH: 'LH-A359',
  AF: 'AF-A359',
  BA: 'BA-A35K',
  KL: 'KL-B789',
  IB: 'IB-A359',
  AZ: 'AZ-A339',
  EK: 'EK-A388',
  QR: 'QR-B789',
  DL: 'DL-A21N',
  AA: 'AA-A21N',
  UA: 'UA-B77W',
  AS: 'AS-B39M',
  AC: 'AC-B789',
};

const SHORT_HAUL_AIRCRAFT: Record<string, string> = {
  SU: 'SU-A320',
  LH: 'LH-A20N',
  TK: 'TK-A21N',
  UA: 'UA-B39M',
};

function pickAircraft(airlineCode: string, durationMinutes: number): string {
  if (durationMinutes < 180 && SHORT_HAUL_AIRCRAFT[airlineCode]) {
    return SHORT_HAUL_AIRCRAFT[airlineCode];
  }

  return AIRCRAFT_BY_AIRLINE[airlineCode];
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const airlineFlightCounters: Record<string, number> = {};

function resetFlightNumberCounters() {
  for (const key of Object.keys(airlineFlightCounters)) {
    delete airlineFlightCounters[key];
  }
}

function nextFlightNumber(airlineCode: string): string {
  const current = airlineFlightCounters[airlineCode] ?? 99;
  airlineFlightCounters[airlineCode] = current + 1;
  return `${airlineCode}${airlineFlightCounters[airlineCode]}`;
}

function buildFlightNumber(airlineCode: string): string {
  return nextFlightNumber(airlineCode);
}

export function generateFlightsForRoute(route: RouteSeedConfig): GeneratedFlight[] {
  const flights: GeneratedFlight[] = [];
  const startMinutes = 6 * 60;
  const endMinutes = 23 * 60;
  const slotMinutes = Math.floor((endMinutes - startMinutes) / Math.max(route.flightsPerDay, 1));

  for (let i = 0; i < route.flightsPerDay; i++) {
    const airlineCode = route.airlines[i % route.airlines.length];
    const departureMinutes = startMinutes + i * slotMinutes;
    const departureTime = formatTime(departureMinutes);
    const arrivalMinutes = departureMinutes + route.durationMinutes;

    flights.push({
      airlineCode,
      flightNumber: buildFlightNumber(airlineCode),
      from: route.from,
      to: route.to,
      durationMinutes: route.durationMinutes,
      departureTime,
      arrivalTime: formatTime(arrivalMinutes),
      aircraftCode: pickAircraft(airlineCode, route.durationMinutes),
      basePriceUsd: computeFlightTemplatePriceUsd(
        route.from,
        route.to,
        airlineCode,
        departureTime,
      ),
      days: route.days ?? SEED_DAYS,
    });
  }

  return flights;
}

export function generateAllFlights(routes: RouteSeedConfig[]): GeneratedFlight[] {
  resetFlightNumberCounters();
  return routes.flatMap((route) => generateFlightsForRoute(route));
}

export function departureDateForDay(
  baseDate: Date,
  dayOffset: number,
  departureTime: string,
): Date {
  const [hours, minutes] = departureTime.split(':').map(Number);
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export { parseTime };
