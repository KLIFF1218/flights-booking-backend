import { Injectable } from '@nestjs/common';
import { YooKassaWebhookDto } from './dto/yookassa-webhook.dto';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';
import { StripeService } from '../providers/stripe/stripe.service';
import { PaymentHandler } from '../payment.handler';
import { Logger } from 'nestjs-pino';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { PaymentProvider } from '@prisma/client';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class WebhookService {
  constructor(
    private readonly yookassaProvider: YookassaProvider,
    private readonly stripeService: StripeService,
    private readonly paymentHandler: PaymentHandler,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {}

  async handleYookassa(dto: YooKassaWebhookDto, ip: string) {
    this.yookassaProvider.verifyWebhookIp(ip);

    const result = await this.yookassaProvider.handleWebhook(dto);
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
    const event = await this.stripeService.parseEvent(dto, sig);
    this.logger.debug({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    const result = await this.stripeService.handleWebhook(event);

    if (!result) {
      runSafely(() =>
        this.metrics.recordWebhookIgnored(PaymentProvider.STRIPE, 'unhandled_event'),
      );
      return { ok: true };
    }

    return await this.paymentHandler.processResult(result);
  }
}
