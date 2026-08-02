import { BookingStatus, PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentAbandonmentService } from './payment-abandonment.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type PaymentProviderService } from './payment-provider.service';
import { type BookingPaymentLifecycleService } from '../../bookings/services/booking-payment-lifecycle.service';
import { type Logger } from 'nestjs-pino';
import { createBookingMetricsMock } from '../../bookings/metrics/booking-metrics.mock';

describe('PaymentAbandonmentService', () => {
  let service: PaymentAbandonmentService;

  const prisma = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const paymentProviderService = {
    cancelPendingPayment: jest.fn(),
    cancelPendingPaymentBestEffort: jest.fn(),
    refundSucceededPayment: jest.fn(),
  };
  const bookingPaymentLifecycle = {
    expireUnpaidPaymentPending: jest.fn(),
    invalidateBooking: jest.fn(),
    releaseSeatsAndInventoryForTicketingFailure: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.booking.findMany.mockReset();
    prisma.booking.findUnique.mockReset();
    prisma.$transaction.mockReset();
    paymentProviderService.cancelPendingPaymentBestEffort.mockReset();
    service = new PaymentAbandonmentService(
      prisma as unknown as PrismaService,
      paymentProviderService as unknown as PaymentProviderService,
      bookingPaymentLifecycle as unknown as BookingPaymentLifecycleService,
      logger as unknown as Logger,
      createBookingMetricsMock(),
      {
        recordPaymentAbandoned: jest.fn(),
      } as never,
    );
  });

  it('does not expire PAYMENT_PENDING bookings via booking TTL query', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    prisma.booking.findMany.mockResolvedValue([]);

    await expect(service.expireStalePayments(now)).resolves.toBe(0);

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.PAYMENT_PENDING,
        transaction: {
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED],
          },
          paymentExpiresAt: { lt: now },
        },
      },
      select: { id: true },
      take: 100,
    });
  });

  it('abandons stale payment sessions at provider and locally', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAYMENT_PENDING,
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        externalId: 'cs_test_1',
      },
      snapshot: {
        offer: {
          itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
        },
        pricing: { travelers: [] },
      },
    });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );
    bookingPaymentLifecycle.expireUnpaidPaymentPending.mockResolvedValue(true);

    await expect(service.expireStalePayments(now)).resolves.toBe(1);

    expect(paymentProviderService.cancelPendingPaymentBestEffort).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'cs_test_1',
      { transactionId: 'tx-1' },
    );
    expect(bookingPaymentLifecycle.expireUnpaidPaymentPending).toHaveBeenCalledWith(
      expect.any(Object),
      'booking-1',
      expect.objectContaining({
        offer: expect.any(Object),
      }),
    );
    expect(bookingPaymentLifecycle.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('does not abandon when payment was finalized before CAS', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAYMENT_PENDING,
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        externalId: 'cs_test_1',
      },
      snapshot: {
        offer: {
          itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
        },
        pricing: { travelers: [] },
      },
    });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        booking: {
          updateMany: jest.fn(),
        },
      }),
    );

    await expect(service.abandonPayment('booking-1')).resolves.toBe(false);

    expect(paymentProviderService.cancelPendingPaymentBestEffort).not.toHaveBeenCalled();
    expect(bookingPaymentLifecycle.expireUnpaidPaymentPending).not.toHaveBeenCalled();
    expect(bookingPaymentLifecycle.invalidateBooking).not.toHaveBeenCalled();
  });

  it('does not abandon when transaction is no longer pending', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAYMENT_PENDING,
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.CANCELED,
        provider: PaymentProvider.STRIPE,
        externalId: 'cs_test_1',
      },
    });

    await expect(service.abandonPayment('booking-1')).resolves.toBe(false);

    expect(paymentProviderService.cancelPendingPaymentBestEffort).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  describe('compensateTicketingFailure', () => {
    const bookingSnapshot = {
      offer: {
        itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
      },
      pricing: { travelers: [{ passengerType: 'ADULT' }] },
    };

    const paidBooking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.FAILED,
      snapshot: bookingSnapshot,
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.SUCCEED,
        provider: PaymentProvider.STRIPE,
        externalId: 'pi_test_1',
        providerMeta: {},
      },
    };

    function freshPaidBooking(providerMeta: Record<string, unknown> = {}): typeof paidBooking {
      return {
        ...paidBooking,
        transaction: {
          ...paidBooking.transaction,
          providerMeta: { ...providerMeta },
        },
      };
    }

    function mockCompensationTransaction(): void {
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          transaction: {
            findUnique: jest.fn().mockResolvedValue({ providerMeta: {} }),
            update: jest.fn(),
          },
        }),
      );
      prisma.transaction.update.mockResolvedValue({});
      bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure.mockResolvedValue(
        undefined,
      );
    }

    it('refunds before releasing seats and marks compensation complete', async () => {
      prisma.booking.findUnique.mockResolvedValue(freshPaidBooking());
      paymentProviderService.refundSucceededPayment.mockResolvedValue(undefined);
      mockCompensationTransaction();

      await service.compensateTicketingFailure('booking-1', 'PRICING_NOT_FOUND');

      expect(paymentProviderService.refundSucceededPayment).toHaveBeenCalledWith(
        PaymentProvider.STRIPE,
        'pi_test_1',
        'ticketing-fail-refund-tx-1',
      );
      expect(bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure).toHaveBeenCalledWith(
        expect.any(Object),
        'booking-1',
        bookingSnapshot,
      );
      expect(bookingPaymentLifecycle.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
    });

    it('does not release seats when refund fails', async () => {
      prisma.booking.findUnique.mockResolvedValue(freshPaidBooking());
      paymentProviderService.refundSucceededPayment.mockRejectedValue(new Error('stripe down'));

      await expect(
        service.compensateTicketingFailure('booking-1', 'PRICING_NOT_FOUND'),
      ).rejects.toThrow('stripe down');

      expect(bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(bookingPaymentLifecycle.invalidateBooking).not.toHaveBeenCalled();
    });

    it('skips refund and release when compensation was already completed', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        freshPaidBooking({
          ticketingFailedRefundCompleted: true,
          ticketingFailedInventoryReleased: true,
        }),
      );

      await service.compensateTicketingFailure('booking-1', 'PRICING_NOT_FOUND');

      expect(paymentProviderService.refundSucceededPayment).not.toHaveBeenCalled();
      expect(bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('releases inventory once when refund was already marked complete', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        freshPaidBooking({ ticketingFailedRefundCompleted: true }),
      );
      mockCompensationTransaction();

      await service.compensateTicketingFailure('booking-1', 'PRICING_NOT_FOUND');

      expect(paymentProviderService.refundSucceededPayment).not.toHaveBeenCalled();
      expect(bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure).toHaveBeenCalled();
    });

    it('fails when paid transaction has no external id', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...freshPaidBooking(),
        transaction: {
          ...freshPaidBooking().transaction,
          externalId: null,
        },
      });

      await expect(
        service.compensateTicketingFailure('booking-1', 'PRICING_NOT_FOUND'),
      ).rejects.toThrow('Ticketing failure refund requires payment external id');

      expect(paymentProviderService.refundSucceededPayment).not.toHaveBeenCalled();
      expect(bookingPaymentLifecycle.releaseSeatsAndInventoryForTicketingFailure).not.toHaveBeenCalled();
    });
  });
});
