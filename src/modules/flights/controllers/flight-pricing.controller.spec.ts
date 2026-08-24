import { Test, type TestingModule } from '@nestjs/testing';
import { FlightPricingController } from './flight-pricing.controller';
import { FlightsPricingService } from '../services/pricing/flight-pricing.service';

describe('FlightPricingController', () => {
  let controller: FlightPricingController;
  let module: TestingModule;
  const pricingService = { price: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      controllers: [FlightPricingController],
      providers: [{ provide: FlightsPricingService, useValue: pricingService }],
    }).compile();
    controller = module.get(FlightPricingController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('delegates pricing request to service', async () => {
    pricingService.price.mockResolvedValue({ id: 'offer-1' });

    await expect(
      controller.price({
        searchId: 'search-1',
        offerId: 'offer-1',
        options: { seats: [] },
      } as any),
    ).resolves.toEqual({ id: 'offer-1' });

    expect(pricingService.price).toHaveBeenCalledWith('search-1', 'offer-1', { seats: [] });
  });
});
