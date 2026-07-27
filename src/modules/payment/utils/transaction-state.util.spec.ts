import { BookingStatus, TransactionStatus } from '@prisma/client';
import {
  cancelTransactionIfAbandonable,
  cancelTransactionIfPending,
  finalizeTransactionIfPending,
  finalizeTransactionToSucceed,
  isAbandonableTransactionStatus,
  markBookingCanceledIfPaymentPending,
  markBookingExpiredIfPaymentPending,
  markBookingPaidIfPending,
  markTransactionAuthorizedIfPending,
} from './transaction-state.util';

describe('transaction-state.util', () => {
  const client = {
    transaction: {
      updateMany: jest.fn(),
    },
    booking: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finalizeTransactionIfPending updates only pending transactions', async () => {
    client.transaction.updateMany.mockResolvedValue({ count: 1 });

    const updated = await finalizeTransactionIfPending(client, 'tx-1', {
      externalId: 'ext-1',
    });

    expect(updated).toBe(true);
    expect(client.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'tx-1', status: TransactionStatus.PENDING },
      data: { externalId: 'ext-1' },
    });
  });

  it('finalizeTransactionToSucceed moves pending or authorized to succeed', async () => {
    client.transaction.updateMany.mockResolvedValue({ count: 1 });

    const updated = await finalizeTransactionToSucceed(client, 'tx-1', {
      externalId: 'ext-1',
    });

    expect(updated).toBe(true);
    expect(client.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tx-1',
        status: { in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED] },
      },
      data: {
        externalId: 'ext-1',
        status: TransactionStatus.SUCCEED,
      },
    });
  });

  it('markTransactionAuthorizedIfPending updates only pending transactions', async () => {
    client.transaction.updateMany.mockResolvedValue({ count: 1 });

    const updated = await markTransactionAuthorizedIfPending(client, 'tx-1', {
      externalId: 'ext-1',
    });

    expect(updated).toBe(true);
    expect(client.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'tx-1', status: TransactionStatus.PENDING },
      data: {
        externalId: 'ext-1',
        status: TransactionStatus.AUTHORIZED,
      },
    });
  });

  it('markBookingPaidIfPending updates only payment-pending bookings', async () => {
    client.booking.updateMany.mockResolvedValue({ count: 1 });

    const updated = await markBookingPaidIfPending(client, 'booking-1');

    expect(updated).toBe(true);
    expect(client.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.PAID },
    });
  });

  it('markBookingCanceledIfPaymentPending cancels only payment-pending bookings', async () => {
    client.booking.updateMany.mockResolvedValue({ count: 1 });

    const updated = await markBookingCanceledIfPaymentPending(client, 'booking-1');

    expect(updated).toBe(true);
    expect(client.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.CANCELED },
    });
  });

  it('cancelTransactionIfPending cancels only pending transactions', async () => {
    client.transaction.updateMany.mockResolvedValue({ count: 1 });

    const updated = await cancelTransactionIfPending(client, 'tx-1');

    expect(updated).toBe(true);
    expect(client.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'tx-1', status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.CANCELED },
    });
  });

  it('cancelTransactionIfAbandonable cancels pending or authorized transactions', async () => {
    client.transaction.updateMany.mockResolvedValue({ count: 0 });

    const updated = await cancelTransactionIfAbandonable(client, 'tx-1');

    expect(updated).toBe(false);
    expect(client.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tx-1',
        status: { in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED] },
      },
      data: { status: TransactionStatus.CANCELED },
    });
  });

  it('markBookingExpiredIfPaymentPending expires only payment-pending bookings', async () => {
    client.booking.updateMany.mockResolvedValue({ count: 1 });

    const updated = await markBookingExpiredIfPaymentPending(client, 'booking-1');

    expect(updated).toBe(true);
    expect(client.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PAYMENT_PENDING },
      data: { status: BookingStatus.EXPIRED },
    });
  });

  it('isAbandonableTransactionStatus returns true for pending and authorized', () => {
    expect(isAbandonableTransactionStatus(TransactionStatus.PENDING)).toBe(true);
    expect(isAbandonableTransactionStatus(TransactionStatus.AUTHORIZED)).toBe(true);
    expect(isAbandonableTransactionStatus(TransactionStatus.SUCCEED)).toBe(false);
  });
});
