import { Test, type TestingModule } from '@nestjs/testing';
import { AirportsController } from './airports.controller';
import { AirportsService } from '../services/airports.service';

describe('AirportsController', () => {
  let controller: AirportsController;
  let service: { searchAirports: jest.Mock };

  beforeEach(async () => {
    service = { searchAirports: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirportsController],
      providers: [{ provide: AirportsService, useValue: service }],
    }).compile();

    controller = module.get<AirportsController>(AirportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('searchAirports delegates to AirportsService', async () => {
    const dto = { q: 'SVO', limit: 10 };
    const expected = {
      data: [{ id: '1', iataCode: 'SVO' }],
      meta: { count: 1, limit: 10, hasNextPage: false, nextCursor: null },
    };
    service.searchAirports.mockResolvedValue(expected);

    await expect(controller.searchAirports(dto as any)).resolves.toEqual(expected);
    expect(service.searchAirports).toHaveBeenCalledWith(dto);
  });
});
