import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import Stripe, { Checkout } from 'stripe';
import { PaymentProviderAdapter } from '../../interfaces/payment.provider.interface';
import { PaymentWebhookResult } from '../../interfaces/payment-webhook-result.dto';
import { Currency, PaymentProvider, TransactionStatus } from '@prisma/client';
import type { StripePaymentIntentObject, StripeWebhookEvent } from './stripe-webhook.types';

type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class StripeService implements PaymentProviderAdapter {
  private stripeClient: StripeClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  private getStripeClient(): StripeClient {
    if (!this.stripeClient) {
      const secret = this.config.get<string>('STRIPE_SECRET_KEY');
      if (!secret) {
        throw new BadRequestException(
          'Stripe is not configured. Set STRIPE_SECRET_KEY to enable Stripe payments.',
        );
      }
      this.stripeClient = new Stripe(secret);
    }
    return this.stripeClient;
  }

  private getWebhookSecret(): string {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.');
    }
    return secret;
  }

  private getAppUrl(): string {
    const appUrl = this.config.get<string>('APP_URL');
    if (!appUrl) {
      throw new BadRequestException('APP_URL is not set (required for Stripe redirect URLs).');
    }
    return appUrl;
  }

  async createPayment(params: {
    transactionId: string;
    bookingId: string;
    amount: number;
    currency: Currency;
    idempotencyKey: string;
  }): Promise<{ externalId: string; redirectUrl: string; meta?: unknown }> {
    const appUrl = this.getAppUrl();
    const successUrl = `${appUrl}/payment/${params.transactionId}/success`;
    const cancelUrl = `${appUrl}/payment/${params.transactionId}/cancel`;

    const currency = String(params.currency).toLowerCase();
    const amountCents = Math.round(Number(params.amount) * 100);

    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: 'Booking payment' },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          transactionId: params.transactionId,
          bookingId: params.bookingId,
        },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    return { externalId: session.id, redirectUrl: session.url ?? successUrl, meta: session };
  }

  async getOpenCheckoutSessionUrl(sessionId: string): Promise<string | null> {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status === 'open' && session.url) {
      return session.url;
    }

    return null;
  }

  async cancelPendingCheckoutSession(sessionId: string): Promise<void> {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status === 'open') {
      await stripe.checkout.sessions.expire(sessionId);
    }
  }

  async refundPayment(paymentId: string, idempotencyKey?: string): Promise<void> {
    const stripe = this.getStripeClient();
    await stripe.refunds.create(
      { payment_intent: paymentId },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
  }

  async parseEvent(rawBody: Buffer, signature: string): Promise<StripeWebhookEvent> {
    try {
      return this.getStripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        this.getWebhookSecret(),
      ) as StripeWebhookEvent;
    } catch (err: unknown) {
      this.logger.error(
        { err: err instanceof Error ? err : String(err) },
        'Stripe webhook verification failed',
      );
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleWebhook(event: StripeWebhookEvent): Promise<PaymentWebhookResult | null> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Checkout.Session;
        const transactionId = session.metadata?.transactionId;
        const bookingId = session.metadata?.bookingId;
        const paymentId =
          typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

        if (!transactionId || !bookingId) return null;

        const status =
          session.payment_status === 'paid' ? TransactionStatus.SUCCEED : TransactionStatus.FAILED;

        return {
          transactionId,
          bookingId,
          paymentId,
          provider: PaymentProvider.STRIPE,
          eventId: event.id,
          status,
          method: 'card',
        };
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as StripePaymentIntentObject;
        const transactionId = pi.metadata?.transactionId;
        const bookingId = pi.metadata?.bookingId;
        if (!transactionId || !bookingId) return null;
        return {
          transactionId,
          bookingId,
          paymentId: pi.id,
          provider: PaymentProvider.STRIPE,
          eventId: event.id,
          status: TransactionStatus.SUCCEED,
          method: 'card',
        };
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as StripePaymentIntentObject;
        const transactionId = pi.metadata?.transactionId;
        const bookingId = pi.metadata?.bookingId;
        if (!transactionId || !bookingId) return null;
        return {
          transactionId,
          bookingId,
          paymentId: pi.id,
          provider: PaymentProvider.STRIPE,
          eventId: event.id,
          status: TransactionStatus.FAILED,
          method: 'card',
        };
      }

      default:
        return null;
    }
  }
}
