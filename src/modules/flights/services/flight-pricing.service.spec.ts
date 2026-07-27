import { Test, type TestingModule } from '@nestjs/testing';
import { FlightsPricingService } from './flight-pricing.service';
import { FLIGHT_PRICING_PROVIDER } from '../providers/flight-pricing.provider';

describe('FlightsPricingService', () => {
  let service: FlightsPricingService;
  let module: TestingModule;
  const provider = { price: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      providers: [
        FlightsPricingService,
        { provide: FLIGHT_PRICING_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = module.get(FlightsPricingService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('delegates to pricing provider', async () => {
    provider.price.mockResolvedValue({ id: 'offer-1', price: { total: 100 } });

    await expect(service.price('search-1', 'offer-1', { seats: [] })).resolves.toEqual({
      id: 'offer-1',
      price: { total: 100 },
    });
    expect(provider.price).toHaveBeenCalledWith('search-1', 'offer-1', { seats: [] });
  });
});
