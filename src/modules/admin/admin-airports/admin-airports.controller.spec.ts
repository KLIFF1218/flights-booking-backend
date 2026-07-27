import { Test, type TestingModule } from '@nestjs/testing';
import { AdminAirportsController } from './admin-airports.controller';
import { AdminAirportsService } from './admin-airports.service';

const mockAirports = [{ id: 'ap_1', name: 'Sheremetyevo', city: 'Moscow', iataCode: 'SVO' }];

describe('AdminAirportsController', () => {
  let controller: AdminAirportsController;

  const serviceMock = {
    findAll: jest.fn().mockResolvedValue({
      data: mockAirports,
      meta: { limit: 20, nextCursor: null, hasNextPage: false },
    }),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAirportsController],
      providers: [{ provide: AdminAirportsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AdminAirportsController>(AdminAirportsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('findAll delegates to adminAirportsService', async () => {
    const res = await controller.findAll({ limit: 20 } as any);
    expect(serviceMock.findAll).toHaveBeenCalledWith({ limit: 20 });
    expect(res).toEqual({
      data: mockAirports,
      meta: {
        limit: 20,
        nextCursor: null,
        hasNextPage: false,
      },
    });
  });
});
