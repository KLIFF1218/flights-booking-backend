const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  RUB: 90.0,
  GBP: 0.78,
  AED: 3.67,
};

export function convertCurrency(amount: number, from: string, to: string): number {
  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();
  const fromRate = CURRENCY_RATES[normalizedFrom] || 1.0;
  const toRate = CURRENCY_RATES[normalizedTo] || 1.0;
  return (amount / fromRate) * toRate;
}
