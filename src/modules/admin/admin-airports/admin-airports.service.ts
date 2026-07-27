import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AirportsQuery } from './dtos/airport-query';
import { decodeCursor, encodeCursor } from 'src/shared/utils/cursor.util';

interface AdminAirportCursorPayload {
  id: string;
  city: string;
}

@Injectable()
export class AdminAirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: AirportsQuery) {
    const { cursor, limit = 20 } = dto;

    const where: Prisma.AirportWhereInput = {};

    const decoded = decodeCursor<AdminAirportCursorPayload>(cursor);

    if (decoded) {
      where.OR = [
        {
          city: {
            gt: decoded.city,
          },
        },
        {
          id: {
            gt: decoded.id,
          },
          city: decoded.city,
        },
      ];
    }

    const airports = await this.prisma.airport.findMany({
      where,
      orderBy: [
        {
          city: 'asc',
        },
        {
          id: 'asc',
        },
      ],

      select: {
        id: true,
        city: true,
        country: true,
        iataCode: true,
      },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    const hasNextPage = airports.length > limit;
    if (hasNextPage) {
      airports.pop();
    }
    const last = airports[airports.length - 1];
    if (last && hasNextPage) {
      nextCursor = encodeCursor({
        id: last.id,
        city: last.city,
      });
    }

    return {
      data: airports,
      meta: {
        limit,
        nextCursor,
        hasNextPage,
      },
    };
  }
}
