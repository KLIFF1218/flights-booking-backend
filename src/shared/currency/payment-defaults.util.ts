import { BadRequestException } from '@nestjs/common';
import { Currency, PaymentProvider } from '@prisma/client';
import { CurrencyCode } from './currency-code.enum';

export const SUPPORTED_PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  PaymentProvider.YOOKASSA,
  PaymentProvider.STRIPE,
];

/** Currencies accepted by each payment provider at checkout. */
export const PAYMENT_PROVIDER_CURRENCIES: Readonly<
  Partial<Record<PaymentProvider, readonly Currency[]>>
> = {
  [PaymentProvider.YOOKASSA]: [Currency.RUB],
  [PaymentProvider.STRIPE]: [Currency.USD, Currency.EUR],
};

export function assertPaymentProviderCurrencyCompatible(
  provider: PaymentProvider,
  currency: Currency,
): void {
  const allowed = PAYMENT_PROVIDER_CURRENCIES[provider];

  if (!allowed || !allowed.includes(currency)) {
    if (provider === PaymentProvider.YOOKASSA) {
      throw new BadRequestException(
        `YooKassa only supports RUB payments (booking currency: ${currency}). Search with currencyCode: "RUB" or choose Stripe.`,
      );
    }

    throw new BadRequestException(
      `Payment provider ${provider} does not support currency ${currency}.`,
    );
  }
}

export function resolveDefaultPaymentProvider(): PaymentProvider {
  const raw = process.env.PAYMENT_PROVIDER_DEFAULT as PaymentProvider | undefined;
  if (raw && SUPPORTED_PAYMENT_PROVIDERS.includes(raw)) {
    return raw;
  }
  return PaymentProvider.STRIPE;
}

export const DEFAULT_PAYMENT_PROVIDER = resolveDefaultPaymentProvider();

/** Stripe → USD; YooKassa → RUB (YooKassa API accepts RUB only). */
export function resolveDefaultSearchCurrency(): Currency {
  return resolveDefaultPaymentProvider() === PaymentProvider.YOOKASSA ? Currency.RUB : Currency.USD;
}

export function resolveDefaultSearchCurrencyCode(): CurrencyCode {
  return resolveDefaultSearchCurrency() === Currency.RUB ? CurrencyCode.RUB : CurrencyCode.USD;
}
