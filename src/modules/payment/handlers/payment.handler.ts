import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';
import { PaymentWebhookResult } from '../interfaces/payment-webhook-result.dto';
import { Logger } from 'nestjs-pino';
import { IdempotencyService } from '../services/idempotency.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { finalizeTransactionIfPending } from '../utils/transaction-state.util';
import { BookingPaymentLifecycleService } from '../../bookings/services/checkout/booking-payment-lifecycle.service';
import { PaymentProviderService } from '../services/payment-provider.service';
import {
  buildPaymentWebhookIdempotencyKey,
  PAYMENT_WEBHOOK_IDEMPOTENCY_OPERATION,
} from '../constants/payment-idempotency.constants';
import { WEBHOOK_PROCESSING_OUTCOME } from '../constants/payment-webhook.constants';
import {
  shouldIgnoreWebhookAsAlreadyFinalized,
  shouldIgnoreWebhookAsAlreadySucceeded,
  shouldReconcileLateSuccess,
} from '../domain/payment-webhook.policy';
import { AuthorizePaymentUseCase } from '../use-cases/authorize-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { FailPaymentUseCase } from '../use-cases/fail-payment.use-case';
import { ReconcileLateSuccessUseCase } from '../use-cases/reconcile-late-success.use-case';
import type {
  PaymentWebhookCommand,
  PaymentWebhookTransactionContext,
  WebhookSideEffects,
} from '../use-cases/payment-webhook.types';
import type { WebhookProcessingOutcome } from '../constants/payment-webhook.constants';

@Injectable()
export class PaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly idempotency: IdempotencyService,
    private readonly bookingPaymentLifecycle: BookingPaymentLifecycleService,
    private readonly metrics: MetricsService,
    private readonly authorizePaymentUseCase: AuthorizePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly failPaymentUseCase: FailPaymentUseCase,
    private readonly reconcileLateSuccessUseCase: ReconcileLateSuccessUseCase,
    private readonly paymentProviderService: PaymentProviderService,
  ) {}

  async processResult(result: PaymentWebhookResult): Promise<void> {
    const { transactionId, status, paymentId, provider, eventId, method } = result;

    runSafely(() => this.metrics.recordWebhookReceived(provider));

    const idempotencyKey = buildPaymentWebhookIdempotencyKey(transactionId, status);

    const operation = await this.idempotency.tryStart(
      provider,
      idempotencyKey,
      PAYMENT_WEBHOOK_IDEMPOTENCY_OPERATION,
    );

    if (!operation) {
      this.logger.warn({ provider, eventId, idempotencyKey }, 'Webhook already processed');
      runSafely(() => {
        this.metrics.recordPaymentIdempotencyConflict(provider);
        this.metrics.recordWebhookIgnored(provider, 'duplicate');
      });

      return;
    }

    try {
      const command: PaymentWebhookCommand = {
        transactionId,
        paymentId,
        provider,
        method,
        occurredAt: new Date().toISOString(),
      };

      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { booking: true },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (shouldIgnoreWebhookAsAlreadySucceeded(transaction.status)) {
        this.logger.warn(
          { transactionId, status: transaction.status },
          'Transaction already finalized',
        );
        await this.idempotency.complete(operation.id);
        runSafely(() => this.metrics.recordWebhookIgnored(provider, 'already_succeeded'));
        return;
      }

      if (shouldReconcileLateSuccess(status, transaction.status, transaction.booking.status)) {
        const sideEffects = await this.reconcileLateSuccessUseCase.execute({
          transaction,
          command,
        });
        await this.applySideEffects(sideEffects, transaction.booking.userId);
        await this.idempotency.complete(operation.id);
        runSafely(() =>
          this.metrics.recordWebhookProcessed(
            provider,
            WEBHOOK_PROCESSING_OUTCOME.LATE_SUCCESS_REFUNDED,
          ),
        );
        return;
      }

      if (
        shouldIgnoreWebhookAsAlreadyFinalized(
          status,
          transaction.status,
          transaction.booking.status,
        )
      ) {
        this.logger.warn(
          { transactionId, status: transaction.status },
          'Transaction already finalized',
        );
        await this.idempotency.complete(operation.id);
        runSafely(() => this.metrics.recordWebhookIgnored(provider, 'already_finalized'));
        return;
      }

      let sideEffects: WebhookSideEffects = {};
      let needsLateSuccessReconciliation = false;
      const shouldCaptureAfterAuthorize = result.requiresCaptureAfterAuthorize ?? false;

      await this.prisma.$transaction(async (tx) => {
        const current = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: { booking: true },
        });

        if (!current) {
          throw new NotFoundException('Transaction not found');
        }

        const currentContext = current as PaymentWebhookTransactionContext;

        if (status === TransactionStatus.AUTHORIZED) {
          sideEffects = await this.authorizePaymentUseCase.execute(tx, command);
          return;
        }

        if (status === TransactionStatus.SUCCEED) {
          sideEffects = await this.confirmPaymentUseCase.execute(tx, command, currentContext);
          needsLateSuccessReconciliation = sideEffects.needsLateSuccessReconciliation ?? false;
          return;
        }

        const finalized = await finalizeTransactionIfPending(tx, transactionId, {
          status,
          externalId: paymentId,
        });

        if (!finalized) {
          sideEffects = { outcome: WEBHOOK_PROCESSING_OUTCOME.NOOP };
          return;
        }

        if (status === TransactionStatus.CANCELED || status === TransactionStatus.FAILED) {
          sideEffects = await this.failPaymentUseCase.execute(tx, command, currentContext, status);
        }
      });

      if (
        shouldCaptureAfterAuthorize &&
        sideEffects.outcome === WEBHOOK_PROCESSING_OUTCOME.AUTHORIZED
      ) {
        const captureSideEffects = await this.captureAuthorizedPaymentAndConfirm(
          command,
          transactionId,
        );
        sideEffects = captureSideEffects.sideEffects;
        needsLateSuccessReconciliation = captureSideEffects.needsLateSuccessReconciliation;
      }

      if (needsLateSuccessReconciliation) {
        sideEffects = await this.reconcileLateSuccessUseCase.execute({
          transaction,
          command,
        });
      }

      await this.applySideEffects(sideEffects, transaction.booking.userId);

      await this.idempotency.complete(operation.id);
      if (sideEffects.outcome) {
        runSafely(() =>
          this.metrics.recordWebhookProcessed(
            provider,
            sideEffects.outcome as WebhookProcessingOutcome,
          ),
        );
      }
    } catch (error) {
      await this.idempotency.fail(operation.id);
      runSafely(() => this.metrics.recordWebhookProcessed(provider, 'error'));
      throw error;
    }
  }

  private async applySideEffects(
    sideEffects: WebhookSideEffects,
    fallbackUserId: string,
  ): Promise<void> {
    const invalidateBookingId = sideEffects.invalidateBookingId;
    const invalidateUserId = sideEffects.invalidateUserId ?? fallbackUserId;

    if (invalidateBookingId && invalidateUserId) {
      await this.bookingPaymentLifecycle.invalidateBooking(invalidateBookingId, invalidateUserId);
    }
  }

  private async captureAuthorizedPaymentAndConfirm(
    command: PaymentWebhookCommand,
    transactionId: string,
  ): Promise<{
    sideEffects: WebhookSideEffects;
    needsLateSuccessReconciliation: boolean;
  }> {
    if (!this.paymentProviderService.supportsCaptureAfterAuthorize(command.provider)) {
      return { sideEffects: {}, needsLateSuccessReconciliation: false };
    }

    try {
      await this.paymentProviderService.captureAuthorizedPayment(
        command.provider,
        command.paymentId,
      );
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          transactionId,
          paymentId: command.paymentId,
          provider: command.provider,
        },
        'Capture after authorize failed; transaction remains AUTHORIZED',
      );

      return { sideEffects: {}, needsLateSuccessReconciliation: false };
    }

    let sideEffects: WebhookSideEffects = {};
    let needsLateSuccessReconciliation = false;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { booking: true },
      });

      if (!current) {
        throw new NotFoundException('Transaction not found');
      }

      sideEffects = await this.confirmPaymentUseCase.execute(
        tx,
        command,
        current as PaymentWebhookTransactionContext,
      );
      needsLateSuccessReconciliation = sideEffects.needsLateSuccessReconciliation ?? false;
    });

    return { sideEffects, needsLateSuccessReconciliation };
  }
}
