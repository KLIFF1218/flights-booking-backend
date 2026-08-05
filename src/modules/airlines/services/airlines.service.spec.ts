import { Test, type TestingModule } from '@nestjs/testing';
import { AirlinesService } from './airlines.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('AirlinesService', () => {
  let service: AirlinesService;
  let prisma: { airline: { findMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirlinesService,
        {
          provide: PrismaService,
          useValue: {
            airline: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AirlinesService>(AirlinesService);
    prisma = module.get(PrismaService);
  });

  describe('getAirlines', () => {
    it('should return airline list', async () => {
      const result = [
        { id: '1', code: 'AA', name: 'American Airlines' },
        { id: '2', code: 'LH', name: 'Lufthansa' },
      ];

      prisma.airline.findMany.mockResolvedValue(result);

      await expect(service.getAirlines()).resolves.toEqual(result);
      expect(prisma.airline.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          code: true,
        },
      });
    });

    it('should return empty array when no airlines exist', async () => {
      prisma.airline.findMany.mockResolvedValue([]);

      await expect(service.getAirlines()).resolves.toEqual([]);
      expect(prisma.airline.findMany).toHaveBeenCalled();
    });
  });
});
