import { Currency, PaymentProvider } from '@prisma/client';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { PaymentWebhookIngressContext } from '../interfaces/payment.provider.interface';
import type { PaymentWebhookResult } from '../interfaces/payment-webhook-result.dto';
import { PaymentProviderCreateDto } from '../dtos/payment-provider.create.dto';
import { PaymentProviderRegistry } from './payment-provider.registry';

@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly logger: Logger,
  ) {}

  get(dto: PaymentProviderCreateDto) {
    const { amount, currency, idempotencyKey, transactionId, bookingId } = dto;

    return this.registry.get(dto.provider as PaymentProvider).createPayment({
      transactionId,
      bookingId,
      amount: Number(amount),
      currency: currency as Currency,
      idempotencyKey,
    });
  }

  async getPendingPaymentRedirectUrl(
    provider: PaymentProvider,
    externalId: string,
  ): Promise<string | null> {
    return this.registry.get(provider).getPendingPaymentRedirectUrl(externalId);
  }

  async cancelPendingPayment(provider: PaymentProvider, externalId: string): Promise<void> {
    await this.registry.get(provider).cancelPendingPayment(externalId);
  }

  async cancelPendingPaymentBestEffort(
    provider: PaymentProvider,
    externalId: string,
    context: { transactionId: string },
  ): Promise<void> {
    try {
      await this.cancelPendingPayment(provider, externalId);
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error instanceof Error ? error : String(error),
          transactionId: context.transactionId,
          provider,
          externalId,
        },
        'Failed to cancel pending payment at provider',
      );
    }
  }

  async refundSucceededPayment(
    provider: PaymentProvider,
    paymentId: string,
    idempotencyKey?: string,
  ): Promise<void> {
    await this.registry.get(provider).refundPayment(paymentId, idempotencyKey);
  }

  async captureAuthorizedPayment(provider: PaymentProvider, externalId: string): Promise<void> {
    const adapter = this.registry.get(provider);

    if (!adapter.captureAuthorizedPayment) {
      throw new BadRequestException(
        `Provider ${provider} does not support capture after authorize`,
      );
    }

    await adapter.captureAuthorizedPayment(externalId);
  }

  supportsCaptureAfterAuthorize(provider: PaymentProvider): boolean {
    return typeof this.registry.get(provider).captureAuthorizedPayment === 'function';
  }

  verifyWebhookIngress(provider: PaymentProvider, context: PaymentWebhookIngressContext): void {
    const adapter = this.registry.get(provider);

    if (!adapter.verifyWebhookIngress) {
      throw new BadRequestException(
        `Provider ${provider} does not support webhook ingress verification`,
      );
    }

    adapter.verifyWebhookIngress(context);
  }

  async parseWebhookIngress(
    provider: PaymentProvider,
    context: PaymentWebhookIngressContext,
  ): Promise<unknown> {
    const adapter = this.registry.get(provider);

    if (!adapter.parseWebhookIngress) {
      throw new BadRequestException(
        `Provider ${provider} does not support webhook ingress parsing`,
      );
    }

    return adapter.parseWebhookIngress(context);
  }

  async handleWebhook(
    provider: PaymentProvider,
    payload: unknown,
  ): Promise<PaymentWebhookResult | null> {
    const adapter = this.registry.get(provider);

    if (!adapter.handleWebhook) {
      throw new BadRequestException(`Provider ${provider} does not support webhooks`);
    }

    return adapter.handleWebhook(payload);
  }
}
