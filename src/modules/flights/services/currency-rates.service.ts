import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from 'src/infra/redis/redis.service';
import { SUPPORTED_FX_CURRENCIES, type SupportedFxCurrency } from 'src/config/currency.config';
import { setCurrencyRates } from '../utils/pricing/currency.util';

const FX_CACHE_KEY = 'fx:rates:USD';

class FxRatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxRatesError';
  }
}

type CachedFxRates = {
  rates: Record<string, number>;
  updatedAt: string;
};

@Injectable()
export class CurrencyRatesService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshRates();
  }

  async refreshRates(): Promise<Record<string, number>> {
    const rates = await this.loadRates();
    setCurrencyRates(rates);
    this.logger.log({ rates, updatedAt: new Date().toISOString() }, 'FX rates loaded');
    return { ...rates };
  }

  async syncRatesFromRedis(): Promise<Record<string, number>> {
    const cacheTtlSeconds = this.configService.get<number>('currency.cacheTtlSeconds', 3600);
    const cached = await this.redisService.get<CachedFxRates>(FX_CACHE_KEY);

    if (cached?.rates) {
      try {
        const rates = this.validateRates(cached.rates);
        setCurrencyRates(rates);
        return { ...rates };
      } catch (error: unknown) {
        this.logger.warn(
          { err: error instanceof Error ? error : String(error) },
          'Cached FX rates invalid during sync',
        );
      }
    }

    const rates = await this.loadRates();
    await this.redisService.set(
      FX_CACHE_KEY,
      {
        rates,
        updatedAt: new Date().toISOString(),
      },
      cacheTtlSeconds,
    );
    setCurrencyRates(rates);
    return { ...rates };
  }

  private async loadRates(): Promise<Record<string, number>> {
    const cacheTtlSeconds = this.configService.get<number>('currency.cacheTtlSeconds', 3600);
    const cached = await this.redisService.get<CachedFxRates>(FX_CACHE_KEY);

    if (cached?.rates) {
      try {
        return this.validateRates(cached.rates);
      } catch (error: unknown) {
        this.logger.warn(
          { err: error instanceof Error ? error : String(error) },
          'Cached FX rates invalid, refreshing',
        );
      }
    }

    try {
      const rates = await this.fetchRates();
      await this.redisService.set(
        FX_CACHE_KEY,
        {
          rates,
          updatedAt: new Date().toISOString(),
        },
        cacheTtlSeconds,
      );

      return rates;
    } catch (error: unknown) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error) },
        'FX rates refresh failed; using configured fallbacks',
      );
      return this.getConfiguredFallbackRates();
    }
  }

  private getConfiguredFallbackRates(): Record<string, number> {
    return this.validateRates({
      ...this.configService.get<Record<SupportedFxCurrency, number>>('currency.fallbackRates', {
        USD: 1,
        EUR: 0.92,
        RUB: 90,
      }),
      USD: 1,
    });
  }

  private async fetchRates(): Promise<Record<string, number>> {
    const fallbackRates = this.configService.get<Record<SupportedFxCurrency, number>>(
      'currency.fallbackRates',
      { USD: 1, EUR: 0.92, RUB: 90 },
    );
    const apiUrl = this.configService.get<string>(
      'currency.apiUrl',
      'https://api.frankfurter.app/latest?from=USD',
    );

    const mergedRates: Record<string, number> = {
      ...fallbackRates,
      USD: 1,
    };

    try {
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new FxRatesError(`FX API responded with ${response.status}`);
      }

      const payload = (await response.json()) as {
        base?: string;
        rates?: Record<string, number>;
      };

      if (payload.rates) {
        Object.assign(mergedRates, payload.rates);
      }

      mergedRates.USD = 1;
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error instanceof Error ? error : String(error),
          apiUrl,
        },
        'FX API fetch failed; using configured fallback rates for missing currencies',
      );
    }

    return this.validateRates(mergedRates);
  }

  private validateRates(rates: Record<string, number>): Record<string, number> {
    const validated: Record<string, number> = { ...rates };

    for (const currency of SUPPORTED_FX_CURRENCIES) {
      const rate = validated[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new FxRatesError(`Missing or invalid FX rate for ${currency}`);
      }
    }

    return validated;
  }
}
