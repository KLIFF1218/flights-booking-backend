import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class AirlinesService {
  constructor(private prisma: PrismaService) {}

  async getAirlines() {
    return this.prisma.airline.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }
}
