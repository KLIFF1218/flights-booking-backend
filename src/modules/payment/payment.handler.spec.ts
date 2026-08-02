import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { BookingStatus, EnumTransport, PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentHandler } from './payment.handler';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { IdempotencyService } from './services/idempotency.service';
import { SeatReleaseService } from '../bookings/services/seat-release.service';
import { BookingsCacheService } from '../bookings/services/bookings-cache.service';
import { PaymentAbandonmentService } from './services/payment-abandonment.service';
import { PaymentProviderService } from './services/payment-provider.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { AuthorizePaymentUseCase } from './use-cases/authorize-payment.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { FailPaymentUseCase } from './use-cases/fail-payment.use-case';
import { ReconcileLateSuccessUseCase } from './use-cases/reconcile-late-success.use-case';
import { BookingPaymentLifecycleService } from '../bookings/services/booking-payment-lifecycle.service';
import { BookingMetricsService } from '../bookings/metrics/booking-metrics.service';
import { createBookingMetricsMock } from '../bookings/metrics/booking-metrics.mock';

describe('PaymentHandler', () => {
  let handler: PaymentHandler;

  const prisma = {
    transaction: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const idempotency = {
    tryStart: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  const seatReleaseService = {
    releaseSeatsForBooking: jest.fn(),
    confirmSeatsForPaidBooking: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const paymentAbandonmentService = {
    refundLateSuccessBestEffort: jest.fn(),
    markLateSuccessReconciliationRecorded: jest.fn(),
    markLateSuccessRefundCompleted: jest.fn(),
  };
  const paymentProviderService = {
    supportsCaptureAfterAuthorize: jest.fn().mockReturnValue(false),
    captureAuthorizedPayment: jest.fn(),
  };
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
  };
  const metrics = {
    recordWebhookReceived: jest.fn(),
    recordWebhookProcessed: jest.fn(),
    recordWebhookIgnored: jest.fn(),
    recordPaymentIdempotencyConflict: jest.fn(),
    recordPayment: jest.fn(),
    recordPaymentValue: jest.fn(),
    recordPaymentMethod: jest.fn(),
  };

  const baseResult = {
    transactionId: 't1',
    bookingId: 'b1',
    paymentId: 'p1',
    provider: PaymentProvider.STRIPE,
    eventId: 'evt_1',
    status: TransactionStatus.SUCCEED,
  };

  const buildTx = (overrides: Record<string, unknown> = {}) => ({
    transaction: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        bookingId: 'b1',
        status: TransactionStatus.PENDING,
        amount: 100,
        booking: {
          id: 'b1',
          userId: 'u1',
          snapshot: {
            offer: { id: 'fi-1', itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }] },
            pricing: { travelers: [{ id: 'tr1' }] },
          },
        },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    seatAssignment: {
      findMany: jest.fn().mockResolvedValue([{ flightSeatId: 'seat-1' }]),
    },
    flightSeat: { updateMany: jest.fn() },
    seatHold: { deleteMany: jest.fn() },
    traveler: { count: jest.fn().mockResolvedValue(1) },
    flightInstance: {
      findUnique: jest.fn().mockResolvedValue({
        seatsAvailable: 9,
        _count: { seats: 10 },
      }),
      update: jest.fn(),
    },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    idempotency.tryStart.mockResolvedValue({ id: 'op_1' });
    seatReleaseService.releaseSeatsForBooking.mockResolvedValue(undefined);
    seatReleaseService.confirmSeatsForPaidBooking.mockResolvedValue(undefined);
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);
    paymentAbandonmentService.refundLateSuccessBestEffort.mockResolvedValue(undefined);
    paymentAbandonmentService.markLateSuccessReconciliationRecorded.mockResolvedValue(undefined);
    paymentAbandonmentService.markLateSuccessRefundCompleted.mockResolvedValue(undefined);

    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.PENDING,
      providerMeta: {},
      booking: {
        id: 'b1',
        userId: 'u1',
        status: BookingStatus.PAYMENT_PENDING,
        snapshot: {
          offer: { id: 'fi-1', itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }] },
          pricing: { travelers: [{ id: 'tr1' }] },
        },
      },
    });
    prisma.$transaction.mockImplementation(async (cb) => cb(buildTx()));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentHandler,
        AuthorizePaymentUseCase,
        ConfirmPaymentUseCase,
        FailPaymentUseCase,
        ReconcileLateSuccessUseCase,
        BookingPaymentLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
        { provide: OutboxService, useValue: outbox },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: SeatReleaseService, useValue: seatReleaseService },
        { provide: BookingsCacheService, useValue: bookingsCache },
        { provide: PaymentAbandonmentService, useValue: paymentAbandonmentService },
        { provide: PaymentProviderService, useValue: paymentProviderService },
        { provide: MetricsService, useValue: metrics },
        { provide: BookingMetricsService, useValue: createBookingMetricsMock() },
      ],
    }).compile();

    handler = module.get<PaymentHandler>(PaymentHandler);
  });

  it('should skip processing when idempotency key already completed', async () => {
    idempotency.tryStart.mockResolvedValue(null);

    await handler.processResult(baseResult);

    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: PaymentProvider.STRIPE, eventId: 'evt_1' }),
      'Webhook already processed',
    );
  });

  it('should process successful payment with outbox and cache invalidation', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb) => cb(tx));

    await handler.processResult(baseResult);

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 't1',
        status: { in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED] },
      },
      data: { status: TransactionStatus.SUCCEED, externalId: 'p1' },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.PAID },
    });
    expect(seatReleaseService.confirmSeatsForPaidBooking).toHaveBeenCalledWith('b1', tx);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        topic: expect.stringContaining('booking.paid'),
        transport: EnumTransport.RABBITMQ,
      }),
    );
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should process canceled payment and release seats', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb) => cb(tx));

    await handler.processResult({
      ...baseResult,
      status: TransactionStatus.CANCELED,
    });

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.CANCELED },
    });
    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith('b1', tx, 'payment_canceled');
    expect(tx.flightInstance.update).toHaveBeenCalledWith({
      where: { id: 'fi-1' },
      data: { seatsAvailable: 10 },
    });
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
  });

  it('should no-op when transaction already succeeded', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.SUCCEED,
      providerMeta: {},
      booking: { id: 'b1', userId: 'u1', status: BookingStatus.PAID, snapshot: {} },
    });

    await handler.processResult(baseResult);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 't1', status: TransactionStatus.SUCCEED }),
      'Transaction already finalized',
    );
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should refund late successful payment after booking expiration', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.CANCELED,
      providerMeta: {},
      booking: {
        id: 'b1',
        userId: 'u1',
        status: BookingStatus.EXPIRED,
        snapshot: {},
      },
    });
    prisma.$transaction.mockImplementation(async (cb) =>
      cb({
        transaction: { findUnique: jest.fn(), update: jest.fn() },
      }),
    );

    await handler.processResult(baseResult);

    expect(paymentAbandonmentService.refundLateSuccessBestEffort).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'p1',
      't1',
    );
    expect(paymentAbandonmentService.markLateSuccessReconciliationRecorded).toHaveBeenCalledWith(
      't1',
      'p1',
      expect.any(Object),
    );
    expect(paymentAbandonmentService.markLateSuccessRefundCompleted).toHaveBeenCalledWith('t1');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        topic: expect.stringContaining('payment.reconciliation.refunded'),
      }),
    );
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should no-op late success when already refunded', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.CANCELED,
      providerMeta: { lateSuccessRefunded: true },
      booking: {
        id: 'b1',
        userId: 'u1',
        status: BookingStatus.EXPIRED,
        snapshot: {},
      },
    });

    await handler.processResult(baseResult);

    expect(paymentAbandonmentService.refundLateSuccessBestEffort).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should no-op when canceled transaction receives another cancel webhook', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.CANCELED,
      providerMeta: {},
      booking: {
        id: 'b1',
        userId: 'u1',
        status: BookingStatus.EXPIRED,
        snapshot: {},
      },
    });

    await handler.processResult({
      ...baseResult,
      status: TransactionStatus.CANCELED,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(paymentAbandonmentService.refundLateSuccessBestEffort).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should finalize AUTHORIZED transaction to SUCCEED without late-success refund', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      bookingId: 'b1',
      status: TransactionStatus.AUTHORIZED,
      providerMeta: {},
      booking: {
        id: 'b1',
        userId: 'u1',
        status: BookingStatus.PAYMENT_PENDING,
        snapshot: {
          offer: { id: 'fi-1', itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }] },
          pricing: { travelers: [{ id: 'tr1' }] },
        },
      },
    });
    const tx = buildTx({
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          bookingId: 'b1',
          status: TransactionStatus.AUTHORIZED,
          amount: 100,
          booking: {
            id: 'b1',
            userId: 'u1',
            status: BookingStatus.PAYMENT_PENDING,
            snapshot: {
              offer: { id: 'fi-1', itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }] },
              pricing: { travelers: [{ id: 'tr1' }] },
            },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    prisma.$transaction.mockImplementation(async (cb) => cb(tx));

    await handler.processResult(baseResult);

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 't1',
        status: { in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED] },
      },
      data: { status: TransactionStatus.SUCCEED, externalId: 'p1' },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.PAID },
    });
    expect(paymentAbandonmentService.refundLateSuccessBestEffort).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledWith('op_1');
  });

  it('should mark idempotency as failed and rethrow when transaction is missing', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(handler.processResult(baseResult)).rejects.toThrow(NotFoundException);
    expect(idempotency.fail).toHaveBeenCalledWith('op_1');
  });

  it('should process failed payment and release seats', async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (cb) => cb(tx));

    await handler.processResult({
      ...baseResult,
      status: TransactionStatus.FAILED,
    });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.FAILED, externalId: 'p1' },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.CANCELED },
    });
    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith('b1', tx, 'payment_failed');
    expect(tx.flightInstance.update).toHaveBeenCalledWith({
      where: { id: 'fi-1' },
      data: { seatsAvailable: 10 },
    });
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
  });
});
