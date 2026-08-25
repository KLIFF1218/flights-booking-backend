import { Injectable } from '@nestjs/common';
import { EnumTransport, TransactionStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { BookingPaymentLifecycleService } from '../../bookings/services/checkout/booking-payment-lifecycle.service';
import { BOOKING_PAYMENT_SEAT_RELEASE_REASON } from '../../bookings/constants/booking-seat-lifecycle.constants';
import {
  PAYMENT_FAILED_OUTBOX_TOPIC,
  PAYMENT_OUTBOX_AGGREGATE_TYPE,
} from '../constants/payment-outbox.constants';
import {
  PAYMENT_FAILURE_REASON,
  WEBHOOK_PROCESSING_OUTCOME,
} from '../constants/payment-webhook.constants';
import type {
  PaymentWebhookCommand,
  PaymentWebhookDbClient,
  PaymentWebhookTransactionContext,
  WebhookSideEffects,
} from './payment-webhook.types';

@Injectable()
export class FailPaymentUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
    private readonly bookingPaymentLifecycle: BookingPaymentLifecycleService,
  ) {}

  async execute(
    tx: PaymentWebhookDbClient,
    command: PaymentWebhookCommand,
    current: PaymentWebhookTransactionContext,
    status: TransactionStatus,
  ): Promise<WebhookSideEffects> {
    const failureReason =
      status === TransactionStatus.FAILED
        ? PAYMENT_FAILURE_REASON.PAYMENT_FAILED
        : PAYMENT_FAILURE_REASON.PAYMENT_CANCELED;

    const seatReleaseReason =
      status === TransactionStatus.FAILED
        ? BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_FAILED
        : BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_CANCELED;

    const canceled = await this.bookingPaymentLifecycle.cancelUnpaid(
      tx,
      current.bookingId,
      current.booking.snapshot,
      seatReleaseReason,
    );

    if (!canceled) {
      return { outcome: WEBHOOK_PROCESSING_OUTCOME.NOOP };
    }

    this.logger.log(
      { bookingId: current.bookingId, reason: failureReason },
      'Booking canceled after payment failure',
    );

    await this.outbox.enqueue(tx, {
      aggregateId: current.bookingId,
      aggregateType: PAYMENT_OUTBOX_AGGREGATE_TYPE,
      topic: PAYMENT_FAILED_OUTBOX_TOPIC,
      payload: {
        bookingId: current.bookingId,
        userId: current.booking.userId,
        transactionId: current.id,
        reason: failureReason,
        occurredAt: command.occurredAt,
      },
      transport: EnumTransport.KAFKA,
    });

    const outcome =
      status === TransactionStatus.FAILED
        ? WEBHOOK_PROCESSING_OUTCOME.FAILED
        : WEBHOOK_PROCESSING_OUTCOME.CANCELED;

    runSafely(() => {
      this.metrics.recordPayment(command.provider, outcome);
      this.metrics.recordPaymentValue(
        Math.round(Number(current.amount) * 100),
        command.provider,
        outcome,
      );
    });

    return {
      invalidateBookingId: current.bookingId,
      invalidateUserId: current.booking.userId,
      outcome,
    };
  }
}
