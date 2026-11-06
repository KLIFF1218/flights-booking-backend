import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { CurrencyRatesService } from './currency-rates.service';
import { RedisService } from 'src/infra/redis/redis.service';

describe('CurrencyRatesService', () => {
  let service: CurrencyRatesService;
  let module: TestingModule;

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    module = await Test.createTestingModule({
      providers: [
        CurrencyRatesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'currency.cacheTtlSeconds') return 3600;
              if (key === 'currency.fallbackRates') {
                return { USD: 1, EUR: 0.92, RUB: 90 };
              }
              return fallback;
            }),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: Logger, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get(CurrencyRatesService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns cached FX rates from redis', async () => {
    redis.get.mockResolvedValue({
      rates: { USD: 1, EUR: 0.92, RUB: 90 },
      updatedAt: new Date().toISOString(),
    });

    await expect(service.syncRatesFromRedis()).resolves.toEqual({
      USD: 1,
      EUR: 0.92,
      RUB: 90,
    });
  });

  it('falls back to configured rates when cache is empty', async () => {
    redis.get.mockResolvedValue(null);

    await expect(service.syncRatesFromRedis()).resolves.toEqual({
      USD: 1,
      EUR: 0.92,
      RUB: 90,
    });
    expect(redis.set).toHaveBeenCalled();
  });

  it('refreshRates loads rates and updates in-memory cache', async () => {
    const logger = module.get(Logger);
    redis.get.mockResolvedValue({
      rates: { USD: 1, EUR: 0.92, RUB: 90 },
      updatedAt: new Date().toISOString(),
    });

    await expect(service.refreshRates()).resolves.toEqual({
      USD: 1,
      EUR: 0.92,
      RUB: 90,
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        rates: { USD: 1, EUR: 0.92, RUB: 90 },
        updatedAt: expect.any(String),
      }),
      'FX rates loaded',
    );
  });
});
