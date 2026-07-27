import { Currency, PaymentProvider } from '@prisma/client';
import { CurrencyCode } from 'src/modules/flights/dtos/search-flight.request.dto';
import {
  resolveDefaultPaymentProvider,
  resolveDefaultSearchCurrency,
  resolveDefaultSearchCurrencyCode,
} from './payment-defaults.util';

describe('payment-defaults.util', () => {
  const original = process.env.PAYMENT_PROVIDER_DEFAULT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PAYMENT_PROVIDER_DEFAULT;
    } else {
      process.env.PAYMENT_PROVIDER_DEFAULT = original;
    }
  });

  it('defaults to STRIPE and USD', () => {
    delete process.env.PAYMENT_PROVIDER_DEFAULT;

    expect(resolveDefaultPaymentProvider()).toBe(PaymentProvider.STRIPE);
    expect(resolveDefaultSearchCurrency()).toBe(Currency.USD);
    expect(resolveDefaultSearchCurrencyCode()).toBe(CurrencyCode.USD);
  });

  it('uses YOOKASSA and RUB when configured', () => {
    process.env.PAYMENT_PROVIDER_DEFAULT = PaymentProvider.YOOKASSA;

    expect(resolveDefaultPaymentProvider()).toBe(PaymentProvider.YOOKASSA);
    expect(resolveDefaultSearchCurrency()).toBe(Currency.RUB);
    expect(resolveDefaultSearchCurrencyCode()).toBe(CurrencyCode.RUB);
  });
});
