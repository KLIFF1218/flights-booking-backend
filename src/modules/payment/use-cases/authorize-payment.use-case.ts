import { Injectable } from '@nestjs/common';
import { markTransactionAuthorizedIfPending } from '../utils/transaction-state.util';
import { WEBHOOK_PROCESSING_OUTCOME } from '../constants/payment-webhook.constants';
import type {
  PaymentWebhookCommand,
  PaymentWebhookDbClient,
  WebhookSideEffects,
} from './payment-webhook.types';

@Injectable()
export class AuthorizePaymentUseCase {
  async execute(
    tx: PaymentWebhookDbClient,
    command: PaymentWebhookCommand,
  ): Promise<WebhookSideEffects> {
    await markTransactionAuthorizedIfPending(tx, command.transactionId, {
      externalId: command.paymentId,
    });

    return { outcome: WEBHOOK_PROCESSING_OUTCOME.AUTHORIZED };
  }
}
