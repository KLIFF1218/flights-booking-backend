import { Test, type TestingModule } from '@nestjs/testing';
import { EnumTransport, PaymentProvider } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';
import { KafkaPublisher } from 'src/infra/kafka/kafka.publisher';
import { BookingEventsPublisher } from 'src/infra/rabbitmq/booking-events.publisher';
import { PaymentPendingCancelOutboxHandler } from 'src/modules/payment/handlers/payment-pending-cancel.outbox-handler';
import { CheckoutCleanupOutboxHandler } from 'src/modules/bookings/handlers/checkout-cleanup.outbox-handler';
import { TicketingFailedOutboxHandler } from 'src/modules/bookings/handlers/ticketing-failed.outbox-handler';
import { CreateCompensationOutboxHandler } from 'src/modules/bookings/handlers/create-compensation.outbox-handler';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { createBookingMetricsMock } from 'src/modules/bookings/metrics/booking-metrics.mock';
import {
  CHECKOUT_CLEANUP_OUTBOX_TOPIC,
  PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC,
} from 'src/modules/bookings/constants/booking-outbox.constants';

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;

  const outbox = {
    reclaimStaleProcessing: jest.fn(),
    fetchPending: jest.fn(),
    tryMarkProcessing: jest.fn(),
    markSent: jest.fn(),
    scheduleRetry: jest.fn(),
  };
  const kafka = { publish: jest.fn() };
  const rabbit = { publishRaw: jest.fn() };
  const paymentPendingCancelHandler = { handle: jest.fn() };
  const checkoutCleanupHandler = { handle: jest.fn() };
  const ticketingFailedHandler = { handle: jest.fn() };
  const createCompensationHandler = { handle: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    outbox.reclaimStaleProcessing.mockResolvedValue(0);
    outbox.fetchPending.mockResolvedValue([]);
    outbox.tryMarkProcessing.mockResolvedValue(true);
    outbox.markSent.mockResolvedValue(undefined);
    outbox.scheduleRetry.mockResolvedValue(undefined);
    kafka.publish.mockResolvedValue(undefined);
    rabbit.publishRaw.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        { provide: OutboxService, useValue: outbox },
        { provide: KafkaPublisher, useValue: kafka },
        { provide: BookingEventsPublisher, useValue: rabbit },
        { provide: Logger, useValue: { debug: jest.fn(), warn: jest.fn() } },
        {
          provide: PaymentPendingCancelOutboxHandler,
          useValue: paymentPendingCancelHandler,
        },
        { provide: CheckoutCleanupOutboxHandler, useValue: checkoutCleanupHandler },
        { provide: TicketingFailedOutboxHandler, useValue: ticketingFailedHandler },
        {
          provide: CreateCompensationOutboxHandler,
          useValue: createCompensationHandler,
        },
        { provide: BookingMetricsService, useValue: createBookingMetricsMock() },
      ],
    }).compile();

    processor = module.get(OutboxProcessor);
  });

  it('reclaims stale messages and exits when queue is empty', async () => {
    await processor.handle();

    expect(outbox.reclaimStaleProcessing).toHaveBeenCalled();
    expect(outbox.fetchPending).toHaveBeenCalledWith(50);
    expect(outbox.tryMarkProcessing).not.toHaveBeenCalled();
  });

  it('publishes kafka domain events using envelope and partition key', async () => {
    const message = {
      id: 'msg-kafka',
      topic: 'payment.failed',
      transport: EnumTransport.KAFKA,
      aggregateId: 'booking-1',
      aggregateType: 'Booking',
      key: 'booking-1',
      payload: {
        bookingId: 'booking-1',
        userId: 'user-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
      },
    };
    outbox.fetchPending.mockResolvedValue([message]);

    await processor.handle();

    expect(kafka.publish).toHaveBeenCalledWith(
      'payment.failed',
      expect.objectContaining({
        eventId: 'msg-kafka',
        eventType: 'payment.failed',
        aggregateId: 'booking-1',
      }),
      'booking-1',
    );
    expect(outbox.markSent).toHaveBeenCalledWith('msg-kafka');
  });

  it('publishes rabbitmq messages using parsed exchange and routing key', async () => {
    const message = {
      id: 'msg-rabbit',
      topic: 'booking.events:booking.paid',
      transport: EnumTransport.RABBITMQ,
      aggregateId: 'booking-1',
      aggregateType: 'Booking',
      key: null,
      payload: { bookingId: 'booking-1' },
    };
    outbox.fetchPending.mockResolvedValue([message]);

    await processor.handle();

    expect(rabbit.publishRaw).toHaveBeenCalledWith('booking.events', 'booking.paid', {
      bookingId: 'booking-1',
    });
    expect(outbox.markSent).toHaveBeenCalledWith('msg-rabbit');
  });

  it('routes internal outbox topics to dedicated handlers', async () => {
    const message = {
      id: 'msg-internal',
      topic: PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC,
      transport: EnumTransport.INTERNAL,
      aggregateId: null,
      aggregateType: null,
      key: null,
      payload: {
        transactionId: 'tx-1',
        provider: PaymentProvider.YOOKASSA,
        externalId: 'pay-1',
      },
    };
    outbox.fetchPending.mockResolvedValue([message]);

    await processor.handle();

    expect(paymentPendingCancelHandler.handle).toHaveBeenCalledWith(message.payload);
    expect(outbox.markSent).toHaveBeenCalledWith('msg-internal');
  });

  it('skips messages that were claimed by another worker', async () => {
    outbox.fetchPending.mockResolvedValue([
      {
        id: 'msg-busy',
        topic: CHECKOUT_CLEANUP_OUTBOX_TOPIC,
        transport: EnumTransport.INTERNAL,
        aggregateId: null,
        aggregateType: null,
        key: null,
        payload: { bookingId: 'booking-1' },
      },
    ]);
    outbox.tryMarkProcessing.mockResolvedValue(false);

    await processor.handle();

    expect(checkoutCleanupHandler.handle).not.toHaveBeenCalled();
    expect(outbox.markSent).not.toHaveBeenCalled();
  });

  it('schedules retry when publishing fails', async () => {
    const message = {
      id: 'msg-fail',
      topic: 'booking.events:booking.paid',
      transport: EnumTransport.RABBITMQ,
      aggregateId: 'booking-1',
      aggregateType: 'Booking',
      key: null,
      payload: { bookingId: 'booking-1' },
    };
    outbox.fetchPending.mockResolvedValue([message]);
    rabbit.publishRaw.mockRejectedValue(new Error('broker down'));

    await processor.handle();

    expect(outbox.scheduleRetry).toHaveBeenCalledWith('msg-fail', expect.any(Error));
    expect(outbox.markSent).not.toHaveBeenCalled();
  });
});
