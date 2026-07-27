import { Currency, PaymentProvider } from '@prisma/client';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProviderCreateDto } from '../dtos/payment-provider.create.dto';
import { StripeService } from '../providers/stripe/stripe.service';

@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly yookassa: YookassaProvider,
    private readonly stripe: StripeService,
    // private readonly stars: StarsProvider,
  ) {}

  get(dto: PaymentProviderCreateDto) {
    const { amount, currency, idempotencyKey, transactionId, bookingId, provider } = dto;
    switch (dto.provider) {
      case PaymentProvider.YOOKASSA:
        return this.yookassa.createPayment({
          transactionId,
          bookingId,
          amount: Number(amount),
          currency: currency as Currency,
          idempotencyKey,
        });
      case PaymentProvider.STRIPE:
        return this.stripe.createPayment({
          transactionId,
          bookingId,
          amount: Number(amount),
          currency: currency as Currency,
          idempotencyKey,
        });
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }

  async getPendingPaymentRedirectUrl(
    provider: PaymentProvider,
    externalId: string,
  ): Promise<string | null> {
    switch (provider) {
      case PaymentProvider.YOOKASSA:
        return this.yookassa.getPendingPaymentRedirectUrl(externalId);
      case PaymentProvider.STRIPE:
        return this.stripe.getOpenCheckoutSessionUrl(externalId);
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }

  async cancelPendingPayment(provider: PaymentProvider, externalId: string): Promise<void> {
    switch (provider) {
      case PaymentProvider.YOOKASSA:
        await this.yookassa.cancelPendingPaymentIfNeeded(externalId);
        return;
      case PaymentProvider.STRIPE:
        await this.stripe.cancelPendingCheckoutSession(externalId);
        return;
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }

  async refundSucceededPayment(
    provider: PaymentProvider,
    paymentId: string,
    idempotencyKey?: string,
  ): Promise<void> {
    switch (provider) {
      case PaymentProvider.YOOKASSA:
        await this.yookassa.refundPayment(paymentId);
        return;
      case PaymentProvider.STRIPE:
        await this.stripe.refundPayment(paymentId, idempotencyKey);
        return;
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }
}
