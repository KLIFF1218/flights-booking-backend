import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { SearchLocationsDto } from '../dtos/airports-search.dto';
import {
  AIRPORT_SEARCH_ORDER_BY,
  buildAirportSearchCursorWhere,
  buildAirportSearchWhere,
  DEFAULT_AIRPORT_SEARCH_LIMIT,
  MAX_AIRPORT_SEARCH_LIMIT,
  type AirportSearchCursor,
} from '../utils/airport-search.util';
import { decodeCursor, encodeCursor } from 'src/shared/utils/cursor.util';

const airportSelect = {
  id: true,
  name: true,
  city: true,
  country: true,
  iataCode: true,
  icaoCode: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.AirportSelect;

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAirports(dto: SearchLocationsDto) {
    const query = dto.q?.trim();

    if (!query || query.length < 2) {
      throw new BadRequestException('Keyword must be at least 2 characters');
    }

    const limit = Math.min(dto.limit ?? DEFAULT_AIRPORT_SEARCH_LIMIT, MAX_AIRPORT_SEARCH_LIMIT);
    const searchWhere = buildAirportSearchWhere(query, dto.country);
    const decoded = decodeCursor<AirportSearchCursor>(dto.cursor);

    const where: Prisma.AirportWhereInput = decoded
      ? {
          AND: [searchWhere, buildAirportSearchCursorWhere(decoded)],
        }
      : searchWhere;

    const airports = await this.prisma.airport.findMany({
      where,
      select: airportSelect,
      orderBy: AIRPORT_SEARCH_ORDER_BY,
      take: limit + 1,
    });

    const hasNextPage = airports.length > limit;
    if (hasNextPage) {
      airports.pop();
    }

    const last = airports[airports.length - 1];
    const nextCursor =
      last && hasNextPage
        ? encodeCursor<AirportSearchCursor>({
            city: last.city,
            name: last.name,
            id: last.id,
          })
        : null;

    return {
      data: airports,
      meta: {
        count: airports.length,
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  }
}
