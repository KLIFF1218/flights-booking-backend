import type { FlightStatus, Prisma } from '@prisma/client';
import { mapStatusToDb } from '../mappers/admin-flight.mapper';

const FINISHED_STATUSES: FlightStatus[] = ['COMPLETED', 'CANCELLED'];
const ACTIVE_STATUSES: FlightStatus[] = ['SCHEDULED', 'DELAYED'];

export function buildAdminFlightsDateWindow(status?: string) {
  const now = new Date();
  const in7Days = new Date(now);
  in7Days.setDate(now.getDate() + 7);

  const past30Days = new Date(now);
  past30Days.setDate(now.getDate() - 30);

  const statusDb = status ? mapStatusToDb(status) : undefined;

  if (statusDb === 'COMPLETED' || statusDb === 'CANCELLED') {
    return {
      status: statusDb,
      departureDate: { gte: past30Days },
    } satisfies Prisma.FlightInstanceWhereInput;
  }

  if (statusDb === 'SCHEDULED' || statusDb === 'DELAYED') {
    return {
      status: statusDb,
      departureDate: { gte: now, lte: in7Days },
    } satisfies Prisma.FlightInstanceWhereInput;
  }

  return {
    OR: [
      {
        status: { in: ACTIVE_STATUSES },
        departureDate: { gte: now, lte: in7Days },
      },
      {
        status: { in: FINISHED_STATUSES },
        departureDate: { gte: past30Days },
      },
    ],
  } satisfies Prisma.FlightInstanceWhereInput;
}

export function buildAdminFlightsSearchFilter(
  search?: string,
): Prisma.FlightInstanceWhereInput | undefined {
  const term = search?.trim();
  if (!term) {
    return undefined;
  }

  return {
    OR: [
      {
        flight: {
          flightNumber: { contains: term, mode: 'insensitive' },
        },
      },
      {
        flight: {
          airline: { name: { contains: term, mode: 'insensitive' } },
        },
      },
      {
        flight: {
          departureAirport: { iataCode: { contains: term, mode: 'insensitive' } },
        },
      },
      {
        flight: {
          arrivalAirport: { iataCode: { contains: term, mode: 'insensitive' } },
        },
      },
    ],
  };
}

export function buildAdminFlightsWhere(query: {
  status?: string;
  search?: string;
}): Prisma.FlightInstanceWhereInput {
  const dateWindow = buildAdminFlightsDateWindow(query.status);
  const searchFilter = buildAdminFlightsSearchFilter(query.search);

  if (!searchFilter) {
    return dateWindow;
  }

  return {
    AND: [dateWindow, searchFilter],
  };
}

export function buildAdminFlightsStatsWhere(): Prisma.FlightInstanceWhereInput {
  return buildAdminFlightsDateWindow();
}
