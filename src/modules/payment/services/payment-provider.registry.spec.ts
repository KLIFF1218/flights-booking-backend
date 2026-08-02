import { PaymentProvider } from '@prisma/client';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { StripeService } from '../providers/stripe/stripe.service';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';

describe('PaymentProviderRegistry', () => {
  const stripe = { provider: PaymentProvider.STRIPE } as StripeService;
  const yookassa = { provider: PaymentProvider.YOOKASSA } as YookassaProvider;

  const registry = new PaymentProviderRegistry(stripe, yookassa);

  it('returns stripe adapter', () => {
    expect(registry.get(PaymentProvider.STRIPE)).toBe(stripe);
  });

  it('returns yookassa adapter', () => {
    expect(registry.get(PaymentProvider.YOOKASSA)).toBe(yookassa);
  });

  it('reports supported providers', () => {
    expect(registry.has(PaymentProvider.STRIPE)).toBe(true);
    expect(registry.has(PaymentProvider.YOOKASSA)).toBe(true);
  });
});
