import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, EnumTransport, PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentStatusEnum } from 'nestjs-yookassa';
import { AdminPaymentsService } from './admin-payments.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type YookassaProvider } from 'src/modules/payment/providers/yoomoney/yoomoney.service';
import { type BookingsCacheService } from 'src/modules/bookings/services/lifecycle/bookings-cache.service';
import { type OutboxService } from 'src/infra/outbox/outbox.service';
import { type SeatReleaseService } from 'src/modules/bookings/services/seats/seat-release.service';
import { type MetricsService } from 'src/infra/metrics/metrics.service';

jest.mock('src/modules/bookings/utils/inventory/booking-inventory.util', () => ({
  releaseFlightInstanceInventoryForBooking: jest.fn().mockResolvedValue(undefined),
}));

describe('AdminPaymentsService', () => {
  let service: AdminPaymentsService;

  const prismaService = {
    transaction: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const yookassa = {
    getPayment: jest.fn(),
    cancelPendingPaymentIfNeeded: jest.fn(),
    refundPayment: jest.fn(),
    capturePayment: jest.fn(),
  };
  const bookingsCache = { invalidateBooking: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const seatReleaseService = { releaseSeatsForBooking: jest.fn() };
  const metrics = { recordAdminAction: jest.fn() };

  const transaction = {
    id: 'tx_1',
    bookingId: 'b1',
    userId: 'u1',
    externalId: 'pay_1',
    provider: PaymentProvider.YOOKASSA,
    status: TransactionStatus.PENDING,
    booking: {
      id: 'b1',
      status: BookingStatus.PAYMENT_PENDING,
      snapshot: {
        offer: {
          id: 'fi-1',
          itineraries: [],
          price: { total: '0', currency: 'RUB', base: '0', grandTotal: '0' },
          numberOfBookableSeats: 1,
        },
        pricing: { travelers: [] },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminPaymentsService(
      prismaService as unknown as PrismaService,
      yookassa as unknown as YookassaProvider,
      bookingsCache as unknown as BookingsCacheService,
      outbox as unknown as OutboxService,
      seatReleaseService as unknown as SeatReleaseService,
      metrics as unknown as MetricsService,
    );
  });

  it('throws NotFoundException when transaction is missing on cancel', async () => {
    prismaService.transaction.findUnique.mockResolvedValue(null);

    await expect(service.cancel('missing')).rejects.toThrow(NotFoundException);
  });

  it('cancels pending payment, releases seats and publishes payment.failed', async () => {
    prismaService.transaction.findUnique.mockResolvedValue(transaction);
    yookassa.getPayment.mockResolvedValue({ status: PaymentStatusEnum.PENDING });
    yookassa.cancelPendingPaymentIfNeeded.mockResolvedValue(undefined);
    seatReleaseService.releaseSeatsForBooking.mockResolvedValue(undefined);

    const tx = {
      transaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      traveler: { count: jest.fn().mockResolvedValue(1) },
      flightInstance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaService.$transaction.mockImplementation(async (cb) => cb(tx));

    const result = await service.cancel('tx_1');

    expect(yookassa.cancelPendingPaymentIfNeeded).toHaveBeenCalledWith('pay_1');
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tx_1',
        status: { in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED] },
      },
      data: { status: TransactionStatus.CANCELED },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'b1',
        status: {
          in: [
            BookingStatus.PAYMENT_PENDING,
            BookingStatus.SEATS_SELECTED,
            BookingStatus.PNR_CREATED,
          ],
        },
      },
      data: { status: BookingStatus.CANCELED },
    });
    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith('b1', tx);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        topic: 'payment.failed',
        transport: EnumTransport.KAFKA,
        aggregateId: 'b1',
        aggregateType: 'Booking',
        payload: expect.objectContaining({
          reason: 'admin_canceled',
          bookingId: 'b1',
          userId: 'u1',
          transactionId: 'tx_1',
        }),
      }),
    );
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
    expect(result).toEqual({ success: true });
  });

  it('refunds succeeded payment before canceling locally', async () => {
    prismaService.transaction.findUnique.mockResolvedValue(transaction);
    yookassa.getPayment.mockResolvedValue({ status: PaymentStatusEnum.SUCCEEDED });
    yookassa.refundPayment.mockResolvedValue(undefined);

    const tx = {
      transaction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      traveler: { count: jest.fn().mockResolvedValue(1) },
      flightInstance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaService.$transaction.mockImplementation(async (cb) => cb(tx));

    await service.cancel('tx_1');

    expect(yookassa.refundPayment).toHaveBeenCalledWith('pay_1');
    expect(yookassa.cancelPendingPaymentIfNeeded).not.toHaveBeenCalled();
    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith('b1', tx);
  });

  it('returns success without side effects when transaction already canceled', async () => {
    prismaService.transaction.findUnique.mockResolvedValue({
      ...transaction,
      status: TransactionStatus.CANCELED,
    });

    await expect(service.cancel('tx_1')).resolves.toEqual({ success: true });
    expect(yookassa.getPayment).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for non-YooKassa provider', async () => {
    prismaService.transaction.findUnique.mockResolvedValue({
      ...transaction,
      provider: PaymentProvider.STRIPE,
    });

    await expect(service.cancel('tx_1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when payment already canceled on confirm', async () => {
    prismaService.transaction.findUnique.mockResolvedValue({
      ...transaction,
      status: TransactionStatus.PENDING,
    });
    yookassa.getPayment.mockResolvedValue({ status: PaymentStatusEnum.CANCELED });

    await expect(service.confirm('tx_1')).rejects.toThrow(BadRequestException);
  });
});
