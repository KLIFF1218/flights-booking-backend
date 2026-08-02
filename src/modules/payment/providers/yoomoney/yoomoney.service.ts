import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConfirmationEnum,
  CurrencyEnum,
  PaymentMethodsEnum,
  PaymentStatusEnum,
  YookassaService,
} from 'nestjs-yookassa';
import { Currency, PaymentProvider, TransactionStatus } from '@prisma/client';
import ipRangeCheck from 'ip-range-check';
import { PaymentProviderAdapter } from '../../interfaces/payment.provider.interface';
import { PaymentWebhookResult } from '../../interfaces/payment-webhook-result.dto';
import { YooKassaWebhookDto } from '../../webhook/dto/yookassa-webhook.dto';
import { Logger } from 'nestjs-pino';
import { isYookassaConfigured } from 'src/config/yookassa.config';

@Injectable()
export class YookassaProvider implements PaymentProviderAdapter {
  readonly provider = PaymentProvider.YOOKASSA;
  private readonly allowedIps: string[];

  constructor(
    private readonly yookassa: YookassaService,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {
    this.allowedIps = [
      '185.71.76.0/27',
      '185.71.77.0/27',
      '77.75.153.0/25',
      '77.75.156.11',
      '77.75.156.35',
      '77.75.154.128/25',
      '2a02:5180::/32',
    ];
  }

  private ensureConfigured(): void {
    if (!isYookassaConfigured(this.config)) {
      throw new BadRequestException(
        'YooKassa is not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_API_KEY to enable YooKassa payments.',
      );
    }
  }

  private getAppUrl(): string {
    const appUrl = this.config.get<string>('APP_URL');
    if (!appUrl) {
      throw new BadRequestException('APP_URL is not set (required for YooKassa return URL).');
    }
    return appUrl;
  }

  async createPayment(params: {
    transactionId: string;
    bookingId: string;
    amount: number;
    currency: Currency;
    idempotencyKey: string;
  }): Promise<{
    externalId: string;
    redirectUrl: string;
    meta?: unknown;
  }> {
    this.ensureConfigured();

    if (params.currency !== Currency.RUB) {
      throw new BadRequestException(
        `YooKassa only supports RUB payments (booking currency: ${params.currency}). Search with currencyCode: "RUB".`,
      );
    }

    const returnUrl = `${this.getAppUrl()}/payment/${params.transactionId}/success`;

    try {
      const payment = await this.yookassa.payments.create({
        amount: {
          value: Number(params.amount.toFixed(2)),
          currency: this.mapCurrency(params.currency),
        },
        description: 'Booking payment',
        payment_method_data: {
          type: PaymentMethodsEnum.BANK_CARD,
        },
        confirmation: {
          type: ConfirmationEnum.REDIRECT,
          return_url: returnUrl,
        },
        capture: false,
        metadata: {
          transactionId: params.transactionId,
          bookingId: params.bookingId,
        },
      });

      const confirmationUrl = this.resolveConfirmationUrl(payment.confirmation, returnUrl);

      return {
        externalId: payment.id,
        redirectUrl: confirmationUrl,
        meta: payment,
      };
    } catch (error: unknown) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          transactionId: params.transactionId,
        },
        'YooKassa createPayment failed',
      );

      throw new ForbiddenException('Failed to create payment');
    }
  }

  async getPayment(paymentId: string) {
    this.ensureConfigured();
    return this.yookassa.payments.getById(paymentId);
  }

  async capturePayment(paymentId: string) {
    this.ensureConfigured();
    return this.yookassa.payments.capture(paymentId);
  }

  async cancelPayment(paymentId: string) {
    this.ensureConfigured();
    return this.yookassa.payments.cancel(paymentId);
  }

  async getPendingPaymentRedirectUrl(paymentId: string): Promise<string | null> {
    const payment = await this.getPayment(paymentId);

    if (payment.status !== PaymentStatusEnum.PENDING) {
      return null;
    }

    const returnUrl = `${this.getAppUrl()}/payment/${payment.metadata?.transactionId}/success`;
    const redirectUrl = this.resolveConfirmationUrl(payment.confirmation, returnUrl);

    return redirectUrl || null;
  }

  async captureAuthorizedPayment(paymentId: string): Promise<void> {
    await this.capturePayment(paymentId);
  }

  async cancelPendingPayment(paymentId: string): Promise<void> {
    await this.cancelPendingPaymentIfNeeded(paymentId);
  }

  async cancelPendingPaymentIfNeeded(paymentId: string): Promise<void> {
    const payment = await this.getPayment(paymentId);

    if (
      payment.status === PaymentStatusEnum.PENDING ||
      payment.status === PaymentStatusEnum.WAITING_FOR_CAPTURE
    ) {
      try {
        await this.cancelPayment(paymentId);
      } catch (err: unknown) {
        this.logger.warn(
          {
            err: err instanceof Error ? err : String(err),
            paymentId,
            status: payment.status,
          },
          'YooKassa cancel failed; continuing with local cleanup',
        );
      }
    }
  }

  async refundPayment(paymentId: string, _idempotencyKey?: string): Promise<void> {
    this.ensureConfigured();
    await this.yookassa.refunds.create({
      payment_id: paymentId,
    });
  }

  async handleWebhook(payload: YooKassaWebhookDto): Promise<PaymentWebhookResult> {
    this.ensureConfigured();
    const transactionId = payload.object.metadata?.transactionId;
    const paymentId = payload.object.id;
    const bookingId = payload.object.metadata?.bookingId;

    if (!transactionId || !bookingId) {
      this.logger.warn('Webhook without transactionId or bookingId', payload);
      throw new ForbiddenException('Invalid webhook payload');
    }

    let status: TransactionStatus = TransactionStatus.PENDING;
    let requiresCaptureAfterAuthorize = false;

    switch (payload.event) {
      case 'payment.waiting_for_capture':
        status = TransactionStatus.AUTHORIZED;
        requiresCaptureAfterAuthorize = true;
        break;
      case 'payment.succeeded':
        status = TransactionStatus.SUCCEED;
        break;

      case 'payment.canceled':
        status = TransactionStatus.CANCELED;
        break;

      default:
        this.logger.log(`Unhandled YooKassa event: ${payload.event}`);
    }

    return {
      transactionId,
      paymentId,
      bookingId,

      provider: PaymentProvider.YOOKASSA,

      eventId: `${payload.event}:${paymentId}`,

      status,
      method: payload.object.payment_method?.type ?? 'unknown',
      requiresCaptureAfterAuthorize,
    };
  }

  verifyWebhookIp(ip: string): void {
    if (!ipRangeCheck(ip, this.allowedIps)) {
      this.logger.warn(`Unauthorized YooKassa IP: ${ip}`);
      throw new ForbiddenException('Unauthorized webhook source');
    }
  }

  private resolveConfirmationUrl(confirmation: unknown, fallback: string): string {
    if (!confirmation || typeof confirmation !== 'object') {
      return fallback;
    }

    const record = confirmation as Record<string, unknown>;
    const url = record.confirmation_url ?? record.return_url;

    return typeof url === 'string' ? url : fallback;
  }

  private mapCurrency(currency: Currency): CurrencyEnum {
    switch (currency) {
      case Currency.RUB:
        return CurrencyEnum.RUB;
      default:
        throw new BadRequestException(`Unsupported currency for YooKassa: ${currency}`);
    }
  }
}
