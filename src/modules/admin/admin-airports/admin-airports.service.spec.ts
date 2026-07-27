import { Test, type TestingModule } from '@nestjs/testing';
import { AdminAirportsService } from './admin-airports.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { encodeCursor } from 'src/shared/utils/cursor.util';

const mockAirports = [
  { id: 'ap_1', city: 'Moscow', country: 'Russia', iataCode: 'SVO' },
  { id: 'ap_2', city: 'Moscow', country: 'Russia', iataCode: 'DME' },
];

describe('AdminAirportsService', () => {
  let service: AdminAirportsService;

  const prismaMock = {
    airport: {
      findMany: jest.fn(),
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminAirportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AdminAirportsService>(AdminAirportsService);
    jest.clearAllMocks();
  });

  it('findAll returns paginated airports without next page', async () => {
    prismaMock.airport.findMany.mockResolvedValue(mockAirports);

    const res = await service.findAll({ limit: 20 });

    expect(prismaMock.airport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        orderBy: [{ city: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(res).toEqual({
      data: mockAirports,
      meta: {
        limit: 20,
        nextCursor: null,
        hasNextPage: false,
      },
    });
  });

  it('findAll returns nextCursor when more results exist', async () => {
    prismaMock.airport.findMany.mockResolvedValue([
      ...mockAirports,
      { id: 'ap_3', city: 'Saint Petersburg', country: 'Russia', iataCode: 'LED' },
    ]);

    const res = await service.findAll({ limit: 2 });

    expect(res.data).toHaveLength(2);
    expect(res.meta.hasNextPage).toBe(true);
    expect(res.meta.nextCursor).toBe(
      encodeCursor({
        id: 'ap_2',
        city: 'Moscow',
      }),
    );
  });
});
