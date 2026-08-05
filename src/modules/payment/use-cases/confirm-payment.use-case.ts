import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import { BookingPaymentLifecycleService } from '../../bookings/services/booking-payment-lifecycle.service';
import { requiresLateSuccessReconciliation } from '../domain/payment-webhook.policy';
import { WEBHOOK_PROCESSING_OUTCOME } from '../constants/payment-webhook.constants';
import { finalizeTransactionToSucceed } from '../utils/transaction-state.util';
import type {
  PaymentWebhookCommand,
  PaymentWebhookDbClient,
  PaymentWebhookTransactionContext,
  WebhookSideEffects,
} from './payment-webhook.types';

@Injectable()
export class ConfirmPaymentUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
    private readonly bookingPaymentLifecycle: BookingPaymentLifecycleService,
  ) {}

  async execute(
    tx: PaymentWebhookDbClient,
    command: PaymentWebhookCommand,
    current: PaymentWebhookTransactionContext,
  ): Promise<WebhookSideEffects> {
    const finalized = await finalizeTransactionToSucceed(tx, command.transactionId, {
      externalId: command.paymentId,
    });

    if (!finalized) {
      if (requiresLateSuccessReconciliation(current.booking.status)) {
        return { needsLateSuccessReconciliation: true };
      }

      this.logger.warn(
        {
          transactionId: command.transactionId,
          bookingId: current.bookingId,
          bookingStatus: current.booking.status,
          transactionStatus: current.status,
        },
        'Success webhook could not finalize payable transaction; skipping late-success refund',
      );

      return { outcome: WEBHOOK_PROCESSING_OUTCOME.SKIPPED_UNPAYABLE };
    }

    const confirmed = await this.bookingPaymentLifecycle.confirmPaid(
      tx,
      current.bookingId,
      command.occurredAt,
    );

    if (!confirmed) {
      if (requiresLateSuccessReconciliation(current.booking.status)) {
        return { needsLateSuccessReconciliation: true };
      }

      this.logger.warn(
        {
          transactionId: command.transactionId,
          bookingId: current.bookingId,
          bookingStatus: current.booking.status,
        },
        'Success webhook finalized transaction but booking was not PAYMENT_PENDING; skipping late-success refund',
      );

      return { outcome: WEBHOOK_PROCESSING_OUTCOME.SKIPPED_BOOKING_STATE };
    }

    logBookingFlowStage(this.logger, BookingFlowStage.PAYMENT_SUCCEEDED, {
      bookingId: current.bookingId,
      transactionId: command.transactionId,
      provider: command.provider,
      paymentId: command.paymentId,
    });

    runSafely(() => {
      this.metrics.recordPayment(command.provider, WEBHOOK_PROCESSING_OUTCOME.CONFIRMED);
      this.metrics.recordPaymentValue(
        Math.round(Number(current.amount) * 100),
        command.provider,
        WEBHOOK_PROCESSING_OUTCOME.CONFIRMED,
      );
      this.metrics.recordPaymentMethod(command.method ?? 'unknown', command.provider);
    });

    return {
      invalidateBookingId: current.bookingId,
      invalidateUserId: current.booking.userId,
      outcome: WEBHOOK_PROCESSING_OUTCOME.CONFIRMED,
    };
  }
}
