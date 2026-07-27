import { BadRequestException } from '@nestjs/common';

export class UnsupportedCurrencyError extends Error {
  constructor(public readonly currency: string) {
    super(`Unsupported currency: ${currency}`);
    this.name = 'UnsupportedCurrencyError';
  }
}

let currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  RUB: 90,
};

export function setCurrencyRates(rates: Record<string, number>): void {
  currencyRates = { ...rates };
}

export function getCurrencyRates(): Readonly<Record<string, number>> {
  return currencyRates;
}

export function createFxRatesSnapshot(): Record<string, number> {
  return { ...currencyRates };
}

function resolveRateFromTable(currency: string, rates: Record<string, number>): number {
  const normalized = currency.toUpperCase();
  const rate = rates[normalized];

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new UnsupportedCurrencyError(normalized);
  }

  return rate;
}

export function convertCurrencyWithRates(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();

  if (normalizedFrom === normalizedTo) {
    return amount;
  }

  const fromRate = resolveRateFromTable(normalizedFrom, rates);
  const toRate = resolveRateFromTable(normalizedTo, rates);

  return (amount / fromRate) * toRate;
}

export function convertCurrency(amount: number, from: string, to: string): number {
  return convertCurrencyWithRates(amount, from, to, currencyRates);
}

export function toCurrencyConversionException(error: unknown): never {
  if (error instanceof UnsupportedCurrencyError) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
