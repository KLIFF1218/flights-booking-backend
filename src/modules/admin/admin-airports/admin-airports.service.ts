import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class AdminAirportsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const airports = await this.prisma.airport.findMany({
      select: {
        id: true,
        city: true,
        iataCode: true,
        name: true,
      },
      orderBy: {
        city: 'asc',
      },
    });
    return airports;
  }
}
