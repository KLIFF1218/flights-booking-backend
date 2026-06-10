import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAirports(query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Keyword must be at least 2 characters');
    }

    const q = query.trim().toLowerCase();

    const airports = await this.prisma.airport.findMany({
      where: {
        OR: [
          {
            iataCode: {
              startsWith: q.toUpperCase(),
            },
          },
          {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          },
          {
            city: {
              contains: q,
              mode: 'insensitive',
            },
          },
          {
            country: {
              contains: q,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              some: {
                name: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },

      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        iataCode: true,
        icaoCode: true,
        latitude: true,
        longitude: true,
      },

      take: 10,
    });

    return {
      data: airports,
      meta: {
        count: airports.length,
      },
    };
  }
}
