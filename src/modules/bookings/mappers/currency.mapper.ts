import { Currency } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const currencyMap: Record<string, Currency> = {
  EUR: Currency.EUR,
  USD: Currency.USD,
  RUB: Currency.RUB,
};

export function mapCurrency(value: string): Currency {
  const currency = currencyMap[value];

  if (!currency) {
    throw new BadRequestException(`Unsupported currency: ${value}`);
  }

  return currency;
}
