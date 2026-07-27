import { convertCurrency, setCurrencyRates, UnsupportedCurrencyError } from './currency.util';

describe('currency.util', () => {
  beforeEach(() => {
    setCurrencyRates({
      USD: 1,
      EUR: 0.5,
      RUB: 100,
    });
  });

  it('returns the same amount for identical currencies', () => {
    expect(convertCurrency(120, 'EUR', 'EUR')).toBe(120);
  });

  it('converts using configured rates', () => {
    expect(convertCurrency(100, 'USD', 'EUR')).toBe(50);
    expect(convertCurrency(100, 'RUB', 'USD')).toBe(1);
  });

  it('throws for unsupported currencies', () => {
    expect(() => convertCurrency(100, 'USD', 'GBP')).toThrow(UnsupportedCurrencyError);
  });
});
