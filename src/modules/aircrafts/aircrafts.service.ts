import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class AircraftsService {
  constructor(private prisma: PrismaService) {}

  async findAll(airlineId?: string) {
    const aircrafts = await this.prisma.aircraft.findMany({
      where: airlineId ? { airlineId } : undefined,
      select: {
        id: true,
        code: true,
        name: true,
        airlineId: true,
        aircraftLayout: {
          select: {
            _count: {
              select: { seats: true },
            },
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    return aircrafts.map((aircraft) => ({
      id: aircraft.id,
      code: aircraft.code,
      name: aircraft.name,
      airlineId: aircraft.airlineId,
      seatsCount: aircraft.aircraftLayout?._count.seats ?? 0,
    }));
  }
}
