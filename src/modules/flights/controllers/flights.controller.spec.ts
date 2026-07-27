import { Test, type TestingModule } from '@nestjs/testing';
import { FlightsController } from './flights.controller';
import { FlightsService } from '../services/flights.service';

describe('FlightsController', () => {
  let controller: FlightsController;
  let module: TestingModule;
  const flightsService = {
    createSearch: jest.fn(),
    getSearchPage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      controllers: [FlightsController],
      providers: [{ provide: FlightsService, useValue: flightsService }],
    }).compile();
    controller = module.get(FlightsController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('delegates search and pagination to FlightsService', async () => {
    flightsService.createSearch.mockResolvedValue({ searchId: 's1', data: [] });
    flightsService.getSearchPage.mockResolvedValue({ searchId: 's1', data: [], meta: {} });

    await expect(controller.createSearch({} as any, {})).resolves.toEqual({
      searchId: 's1',
      data: [],
    });
    await expect(controller.getPage('s1', { limit: 10 })).resolves.toEqual({
      searchId: 's1',
      data: [],
      meta: {},
    });
  });
});
