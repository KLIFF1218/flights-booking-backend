import { Currency } from '@prisma/client';

export function resolveCurrencyFromLocale(locale?: string): Currency {
  if (locale === 'ru') {
    return Currency.RUB;
  }
  return Currency.USD;
}

export function resolveCountryFromLocale(locale?: string): string | undefined {
  if (locale === 'ru') {
    return 'Russia';
  }
  return undefined;
}
