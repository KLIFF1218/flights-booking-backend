import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class AircraftsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.aircraft.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }
}
