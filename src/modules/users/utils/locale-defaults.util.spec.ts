import { Currency } from '@prisma/client';
import { resolveCountryFromLocale, resolveCurrencyFromLocale } from './locale-defaults.util';

describe('locale-defaults.util', () => {
  it('defaults to USD when locale is not Russian', () => {
    expect(resolveCurrencyFromLocale()).toBe(Currency.USD);
    expect(resolveCurrencyFromLocale('en')).toBe(Currency.USD);
  });

  it('uses RUB and Russia for Russian locale', () => {
    expect(resolveCurrencyFromLocale('ru')).toBe(Currency.RUB);
    expect(resolveCountryFromLocale('ru')).toBe('Russia');
  });

  it('returns undefined country for non-Russian locales', () => {
    expect(resolveCountryFromLocale('en')).toBeUndefined();
  });
});
