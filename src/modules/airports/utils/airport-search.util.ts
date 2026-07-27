import type { Prisma } from '@prisma/client';

export const DEFAULT_AIRPORT_SEARCH_LIMIT = 10;
export const MAX_AIRPORT_SEARCH_LIMIT = 50;

export interface AirportSearchCursor {
  city: string;
  name: string;
  id: string;
}

export const AIRPORT_SEARCH_ORDER_BY = [
  { city: 'asc' as const },
  { name: 'asc' as const },
  { id: 'asc' as const },
];

export function buildAirportSearchWhere(query: string, country?: string): Prisma.AirportWhereInput {
  const normalized = query.trim().toLowerCase();
  const iataQuery = query.trim().toUpperCase();

  const where: Prisma.AirportWhereInput = {
    OR: [
      { iataCode: { startsWith: iataQuery } },
      { name: { contains: normalized, mode: 'insensitive' } },
      { city: { contains: normalized, mode: 'insensitive' } },
      { country: { contains: normalized, mode: 'insensitive' } },
      {
        aliases: {
          some: {
            name: {
              contains: normalized,
              mode: 'insensitive',
            },
          },
        },
      },
    ],
  };

  if (country?.trim()) {
    where.AND = [
      {
        country: {
          contains: country.trim(),
          mode: 'insensitive',
        },
      },
    ];
  }

  return where;
}

export function buildAirportSearchCursorWhere(
  cursor: AirportSearchCursor,
): Prisma.AirportWhereInput {
  return {
    OR: [
      { city: { gt: cursor.city } },
      {
        city: cursor.city,
        name: { gt: cursor.name },
      },
      {
        city: cursor.city,
        name: cursor.name,
        id: { gt: cursor.id },
      },
    ],
  };
}
