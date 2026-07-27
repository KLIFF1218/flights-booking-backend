import type { Checkout } from 'stripe';

export interface StripePaymentIntentObject {
  id: string;
  metadata?: Record<string, string | undefined> | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Checkout.Session | StripePaymentIntentObject;
  };
}
