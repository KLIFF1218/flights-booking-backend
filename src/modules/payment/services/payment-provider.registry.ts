import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import type { PaymentProviderAdapter } from '../interfaces/payment.provider.interface';
import { StripeService } from '../providers/stripe/stripe.service';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';

@Injectable()
export class PaymentProviderRegistry {
  private readonly adapters: Map<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    private readonly stripe: StripeService,
    private readonly yookassa: YookassaProvider,
  ) {
    this.adapters = new Map<PaymentProvider, PaymentProviderAdapter>([
      [PaymentProvider.STRIPE, this.stripe],
      [PaymentProvider.YOOKASSA, this.yookassa],
    ]);
  }

  get(provider: PaymentProvider): PaymentProviderAdapter {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }

    return adapter;
  }

  has(provider: PaymentProvider): boolean {
    return this.adapters.has(provider);
  }
}
