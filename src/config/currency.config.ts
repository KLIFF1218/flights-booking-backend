import { registerAs } from '@nestjs/config';

export const SUPPORTED_FX_CURRENCIES = ['USD', 'EUR', 'RUB'] as const;

export type SupportedFxCurrency = (typeof SUPPORTED_FX_CURRENCIES)[number];

const DEFAULT_FALLBACK_RATES: Record<SupportedFxCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  RUB: 90,
};

function parseFallbackRates(raw: string | undefined): Record<SupportedFxCurrency, number> {
  if (!raw) {
    return { ...DEFAULT_FALLBACK_RATES };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return {
      USD: parsed.USD ?? DEFAULT_FALLBACK_RATES.USD,
      EUR: parsed.EUR ?? DEFAULT_FALLBACK_RATES.EUR,
      RUB: parsed.RUB ?? DEFAULT_FALLBACK_RATES.RUB,
    };
  } catch {
    return { ...DEFAULT_FALLBACK_RATES };
  }
}

export default registerAs('currency', () => ({
  baseCurrency: (process.env.FX_BASE_CURRENCY ?? 'USD') as SupportedFxCurrency,
  apiUrl: process.env.FX_API_URL ?? 'https://api.frankfurter.app/latest?from=USD',
  cacheTtlSeconds: Number(process.env.FX_CACHE_TTL_SECONDS ?? 3600),
  fallbackRates: parseFallbackRates(process.env.FX_FALLBACK_RATES),
}));
