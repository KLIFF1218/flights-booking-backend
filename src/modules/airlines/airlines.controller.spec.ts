import { Test, type TestingModule } from '@nestjs/testing';
import { AirlinesController } from './controllers/airlines.controller';
import { AirlinesService } from './airlines.service';

describe('AirlinesController', () => {
  let controller: AirlinesController;
  let service: { getAirlines: jest.Mock };

  beforeEach(async () => {
    service = { getAirlines: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AirlinesController],
      providers: [
        {
          provide: AirlinesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AirlinesController>(AirlinesController);
  });

  it('getAirlines should call airlinesService.getAirlines', async () => {
    service.getAirlines.mockResolvedValue([{ id: '1', code: 'AA', name: 'American Airlines' }]);

    await expect(controller.getAirlines()).resolves.toEqual([
      { id: '1', code: 'AA', name: 'American Airlines' },
    ]);
    expect(service.getAirlines).toHaveBeenCalled();
  });
});
