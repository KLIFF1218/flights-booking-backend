import { Test, type TestingModule } from '@nestjs/testing';
import { AircraftsController } from './controllers/aircrafts.controller';
import { AircraftsService } from './aircrafts.service';

describe('AircraftsController', () => {
  let controller: AircraftsController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AircraftsController],
      providers: [{ provide: AircraftsService, useValue: service }],
    }).compile();

    controller = module.get<AircraftsController>(AircraftsController);
  });

  it('findAll delegates to aircraftsService.findAll', async () => {
    const expected = [
      { id: '1', code: 'A320', name: 'Airbus A320', airlineId: 'al_1', seatsCount: 0 },
    ];
    service.findAll.mockResolvedValue(expected);

    await expect(controller.findAll()).resolves.toEqual(expected);
    expect(service.findAll).toHaveBeenCalledWith(undefined);
  });

  it('findAll passes airlineId query parameter to service', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll('al_1');

    expect(service.findAll).toHaveBeenCalledWith('al_1');
  });
});
