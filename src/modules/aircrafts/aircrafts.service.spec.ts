import { Test, type TestingModule } from '@nestjs/testing';
import { AircraftsService } from './aircrafts.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

const prismaRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ac_1',
  code: 'A320',
  name: 'Airbus A320',
  airlineId: 'al_1',
  aircraftLayout: {
    _count: { seats: 180 },
  },
  ...overrides,
});

const findManySelect = {
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
};

describe('AircraftsService', () => {
  let service: AircraftsService;
  let prisma: { aircraft: { findMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AircraftsService,
        {
          provide: PrismaService,
          useValue: {
            aircraft: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AircraftsService>(AircraftsService);
    prisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('returns mapped aircraft list ordered by code with seatsCount from layout', async () => {
      prisma.aircraft.findMany.mockResolvedValue([
        prismaRow(),
        prismaRow({
          id: 'ac_2',
          code: 'B737',
          name: 'Boeing 737',
          airlineId: 'al_2',
          aircraftLayout: { _count: { seats: 162 } },
        }),
      ]);

      await expect(service.findAll()).resolves.toEqual([
        {
          id: 'ac_1',
          code: 'A320',
          name: 'Airbus A320',
          airlineId: 'al_1',
          seatsCount: 180,
        },
        {
          id: 'ac_2',
          code: 'B737',
          name: 'Boeing 737',
          airlineId: 'al_2',
          seatsCount: 162,
        },
      ]);

      expect(prisma.aircraft.findMany).toHaveBeenCalledWith({
        where: undefined,
        select: findManySelect,
        orderBy: { code: 'asc' },
      });
    });

    it('returns seatsCount 0 when aircraft has no layout', async () => {
      prisma.aircraft.findMany.mockResolvedValue([
        prismaRow({ aircraftLayout: null }),
      ]);

      await expect(service.findAll()).resolves.toEqual([
        {
          id: 'ac_1',
          code: 'A320',
          name: 'Airbus A320',
          airlineId: 'al_1',
          seatsCount: 0,
        },
      ]);
    });

    it('filters by airlineId when provided', async () => {
      prisma.aircraft.findMany.mockResolvedValue([prismaRow()]);

      await service.findAll('al_1');

      expect(prisma.aircraft.findMany).toHaveBeenCalledWith({
        where: { airlineId: 'al_1' },
        select: findManySelect,
        orderBy: { code: 'asc' },
      });
    });

    it('returns empty array when no aircraft exist', async () => {
      prisma.aircraft.findMany.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
      expect(prisma.aircraft.findMany).toHaveBeenCalled();
    });
  });
});
