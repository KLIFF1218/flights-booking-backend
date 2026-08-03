import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { FxRatesSchedulerService } from './fx-rates-scheduler.service';
import { CurrencyRatesService } from '../flights/services/currency-rates.service';

describe('FxRatesSchedulerService', () => {
  let service: FxRatesSchedulerService;
  let module: TestingModule;

  const currencyRatesService = {
    refreshRates: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currencyRatesService.refreshRates.mockResolvedValue({ USD: 1, EUR: 0.92, RUB: 90 });

    module = await Test.createTestingModule({
      providers: [
        FxRatesSchedulerService,
        { provide: CurrencyRatesService, useValue: currencyRatesService },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get(FxRatesSchedulerService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('refreshes rates and logs success', async () => {
    await service.refreshFxRates();

    expect(currencyRatesService.refreshRates).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('FX rates refreshed');
  });

  it('logs and swallows refresh errors', async () => {
    const error = new Error('fx failed');
    currencyRatesService.refreshRates.mockRejectedValue(error);

    await expect(service.refreshFxRates()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(error, 'FX rates refresh failed');
  });
});
