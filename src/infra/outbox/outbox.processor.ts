import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EnumTransport } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { OutboxService } from './outbox.service';
import { KafkaPublisher } from 'src/infra/kafka/kafka.publisher';
import { BookingEventsPublisher } from 'src/infra/rabbitmq/booking-events.publisher';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import {
  PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC,
  CHECKOUT_CLEANUP_OUTBOX_TOPIC,
  BOOKING_TICKETING_FAILED_OUTBOX_TOPIC,
  BOOKING_CREATE_COMPENSATION_OUTBOX_TOPIC,
} from 'src/modules/bookings/constants/booking-outbox.constants';
import {
  PaymentPendingCancelOutboxHandler,
  type PaymentPendingCancelOutboxPayload,
} from 'src/modules/payment/handlers/payment-pending-cancel.outbox-handler';
import {
  CheckoutCleanupOutboxHandler,
  type CheckoutCleanupOutboxPayload,
} from 'src/modules/bookings/handlers/checkout-cleanup.outbox-handler';
import {
  TicketingFailedOutboxHandler,
  type TicketingFailedOutboxPayload,
} from 'src/modules/ticketing/handlers/ticketing-failed.outbox-handler';
import {
  CreateCompensationOutboxHandler,
  type CreateCompensationOutboxPayload,
} from 'src/modules/bookings/handlers/create-compensation.outbox-handler';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { isBookingOutboxTopic } from 'src/modules/bookings/metrics/booking-metrics.util';
import { isKafkaDomainTopic } from 'src/infra/kafka/domain-event.constants';
import {
  buildDomainEventEnvelope,
  resolveDomainEventPartitionKey,
} from 'src/infra/kafka/domain-event-envelope.util';
import { parseRabbitRouting } from './outbox-rabbit.util';

@Injectable()
export class OutboxProcessor {
  constructor(
    private readonly outbox: OutboxService,
    private readonly kafka: KafkaPublisher,
    private readonly rabbit: BookingEventsPublisher,
    private readonly logger: Logger,
    private readonly paymentPendingCancelHandler: PaymentPendingCancelOutboxHandler,
    @Inject(forwardRef(() => CheckoutCleanupOutboxHandler))
    private readonly checkoutCleanupHandler: CheckoutCleanupOutboxHandler,
    @Inject(forwardRef(() => TicketingFailedOutboxHandler))
    private readonly ticketingFailedHandler: TicketingFailedOutboxHandler,
    @Inject(forwardRef(() => CreateCompensationOutboxHandler))
    private readonly createCompensationHandler: CreateCompensationOutboxHandler,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  @Cron('*/5 * * * * *')
  async handle() {
    try {
      await this.outbox.reclaimStaleProcessing();

      const pending = await this.outbox.fetchPending(50);
      if (pending.length === 0) return;
      this.logger.debug(`Outbox processing ${pending.length} messages`);
      for (const msg of pending) {
        try {
          const claimed = await this.outbox.tryMarkProcessing(msg.id);
          if (!claimed) {
            continue;
          }

          if (msg.transport === EnumTransport.INTERNAL) {
            await this.handleInternalMessage(msg);
          } else if (msg.transport === EnumTransport.KAFKA) {
            const message = isKafkaDomainTopic(msg.topic)
              ? buildDomainEventEnvelope(msg)
              : msg.payload;
            const partitionKey = isKafkaDomainTopic(msg.topic)
              ? resolveDomainEventPartitionKey(msg)
              : (msg.key ?? undefined);

            await this.kafka.publish(msg.topic, message, partitionKey);
          } else if (msg.transport === EnumTransport.RABBITMQ) {
            const { exchange, routingKey } = parseRabbitRouting(msg.topic);
            await this.rabbit.publishRaw(exchange, routingKey, msg.payload);
          } else {
            throw new Error(`Unsupported outbox transport: ${String(msg.transport)}`);
          }

          await this.outbox.markSent(msg.id);
          if (isBookingOutboxTopic(msg.topic)) {
            this.bookingMetrics.recordOutboxSent(msg.topic, msg.transport);
          }
          this.logOutboxSent(msg);
        } catch (err) {
          await this.outbox.scheduleRetry(msg.id, err);
        }
      }
    } catch (error) {
      this.logger.error(error, 'Outbox processing failed');
    }
  }

  private async handleInternalMessage(msg: { topic: string; payload: unknown }): Promise<void> {
    switch (msg.topic) {
      case PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC:
        await this.paymentPendingCancelHandler.handle(
          msg.payload as PaymentPendingCancelOutboxPayload,
        );
        return;
      case CHECKOUT_CLEANUP_OUTBOX_TOPIC:
        await this.checkoutCleanupHandler.handle(msg.payload as CheckoutCleanupOutboxPayload);
        return;
      case BOOKING_TICKETING_FAILED_OUTBOX_TOPIC:
        await this.ticketingFailedHandler.handle(msg.payload as TicketingFailedOutboxPayload);
        return;
      case BOOKING_CREATE_COMPENSATION_OUTBOX_TOPIC:
        await this.createCompensationHandler.handle(msg.payload as CreateCompensationOutboxPayload);
        return;
      default:
        throw new Error(`Unknown internal outbox topic: ${msg.topic}`);
    }
  }

  private logOutboxSent(msg: {
    id: string;
    topic: string;
    aggregateId: string | null;
    payload: unknown;
  }): void {
    const payload =
      msg.payload && typeof msg.payload === 'object'
        ? (msg.payload as Record<string, unknown>)
        : undefined;
    const bookingId =
      (typeof payload?.bookingId === 'string' ? payload.bookingId : undefined) ??
      msg.aggregateId ??
      undefined;

    if (!bookingId) {
      return;
    }

    logBookingFlowStage(this.logger, BookingFlowStage.OUTBOX_SENT, {
      bookingId,
      outboxId: msg.id,
      topic: msg.topic,
    });
  }
}
