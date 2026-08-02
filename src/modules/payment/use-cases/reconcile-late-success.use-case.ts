import { Injectable } from '@nestjs/common';
import { EnumTransport } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { PaymentAbandonmentService } from '../services/payment-abandonment.service';
import {
  isLateSuccessReconciliationRecorded,
  isLateSuccessRefundCompleted,
} from '../domain/payment-reconciliation.policy';
import {
  PAYMENT_OUTBOX_AGGREGATE_TYPE,
  PAYMENT_RECONCILIATION_REFUNDED_OUTBOX_TOPIC,
} from '../constants/payment-outbox.constants';
import {
  LATE_SUCCESS_RECONCILIATION_REASON,
  WEBHOOK_PROCESSING_OUTCOME,
} from '../constants/payment-webhook.constants';
import type { PaymentWebhookCommand, WebhookSideEffects } from './payment-webhook.types';

export interface ReconcileLateSuccessInput {
  transaction: {
    id: string;
    bookingId: string;
    providerMeta: unknown;
  };
  command: PaymentWebhookCommand;
}

@Injectable()
export class ReconcileLateSuccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly outbox: OutboxService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
  ) {}

  async execute(input: ReconcileLateSuccessInput): Promise<WebhookSideEffects> {
    const { transaction, command } = input;

    if (isLateSuccessRefundCompleted(transaction.providerMeta)) {
      this.logger.warn(
        { transactionId: transaction.id, bookingId: transaction.bookingId },
        'Late successful payment already refunded',
      );

      return {
        invalidateBookingId: transaction.bookingId,
        outcome: WEBHOOK_PROCESSING_OUTCOME.LATE_SUCCESS_REFUNDED,
      };
    }

    if (!isLateSuccessReconciliationRecorded(transaction.providerMeta)) {
      await this.prisma.$transaction(async (tx) => {
        await this.paymentAbandonmentService.markLateSuccessReconciliationRecorded(
          transaction.id,
          command.paymentId,
          tx,
        );

        await this.outbox.enqueue(tx, {
          aggregateId: transaction.bookingId,
          aggregateType: PAYMENT_OUTBOX_AGGREGATE_TYPE,
          topic: PAYMENT_RECONCILIATION_REFUNDED_OUTBOX_TOPIC,
          payload: {
            bookingId: transaction.bookingId,
            transactionId: transaction.id,
            paymentId: command.paymentId,
            reason: LATE_SUCCESS_RECONCILIATION_REASON,
            occurredAt: command.occurredAt,
          },
          transport: EnumTransport.KAFKA,
        });
      });
    }

    await this.paymentAbandonmentService.refundLateSuccessBestEffort(
      command.provider,
      command.paymentId,
      transaction.id,
    );

    await this.paymentAbandonmentService.markLateSuccessRefundCompleted(transaction.id);

    this.logger.warn(
      {
        bookingId: transaction.bookingId,
        transactionId: transaction.id,
        paymentId: command.paymentId,
      },
      'Late successful payment refunded after booking expiration',
    );

    return {
      invalidateBookingId: transaction.bookingId,
      outcome: WEBHOOK_PROCESSING_OUTCOME.LATE_SUCCESS_REFUNDED,
    };
  }
}
