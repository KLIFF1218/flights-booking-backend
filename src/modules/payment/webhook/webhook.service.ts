import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { YooKassaWebhookDto } from './dto/yookassa-webhook.dto';
import { PaymentHandler } from '../payment.handler';
import { Logger } from 'nestjs-pino';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { PaymentProviderService } from '../services/payment-provider.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly paymentProviderService: PaymentProviderService,
    private readonly paymentHandler: PaymentHandler,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {}

  async handleYookassa(dto: YooKassaWebhookDto, ip: string) {
    this.paymentProviderService.verifyWebhookIngress(PaymentProvider.YOOKASSA, { ip });

    const result = await this.paymentProviderService.handleWebhook(PaymentProvider.YOOKASSA, dto);

    if (!result) {
      runSafely(() =>
        this.metrics.recordWebhookIgnored(PaymentProvider.YOOKASSA, 'unhandled_event'),
      );
      return { ok: true };
    }

    await this.paymentHandler.processResult(result);

    this.logger.log(
      {
        transactionId: result.transactionId,
        status: result.status,
      },
      'YooKassa webhook processed successfully',
    );

    return { ok: true };
  }

  async handleStripe(dto: Buffer, sig: string) {
    const event = await this.paymentProviderService.parseWebhookIngress(PaymentProvider.STRIPE, {
      rawBody: dto,
      stripeSignature: sig,
    });
    this.logger.debug({ eventType: (event as { type?: string }).type }, 'Stripe webhook received');

    const result = await this.paymentProviderService.handleWebhook(PaymentProvider.STRIPE, event);

    if (!result) {
      runSafely(() => this.metrics.recordWebhookIgnored(PaymentProvider.STRIPE, 'unhandled_event'));
      return { ok: true };
    }

    return await this.paymentHandler.processResult(result);
  }
}
