import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentOrphanReconciliationService } from './payment-orphan-reconciliation.service';
import { createBookingMetricsMock } from '../../bookings/metrics/booking-metrics.mock';

describe('PaymentOrphanReconciliationService', () => {
  const prisma = {
    transaction: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const paymentPendingRollback = {
    rollbackPendingPayment: jest.fn(),
  };
  const logger = {
    warn: jest.fn(),
  };

  const service = new PaymentOrphanReconciliationService(
    prisma as never,
    paymentPendingRollback as never,
    createBookingMetricsMock(),
    logger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.transaction.findMany.mockResolvedValue([]);
  });

  it('recovers externalId from provider meta when pending session id exists', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        bookingId: 'booking-1',
        provider: PaymentProvider.STRIPE,
        status: TransactionStatus.PENDING,
        providerMeta: { pendingProviderSessionId: 'cs_test_1' },
      },
    ]);

    await expect(service.reconcileOrphanPendingPayments()).resolves.toBe(1);

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { externalId: 'cs_test_1' },
    });
    expect(paymentPendingRollback.rollbackPendingPayment).not.toHaveBeenCalled();
  });

  it('rolls back orphan pending payments without provider session', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-2',
        bookingId: 'booking-2',
        provider: PaymentProvider.STRIPE,
        status: TransactionStatus.PENDING,
        providerMeta: null,
      },
    ]);

    await expect(service.reconcileOrphanPendingPayments()).resolves.toBe(1);

    expect(paymentPendingRollback.rollbackPendingPayment).toHaveBeenCalledWith('booking-2', 'tx-2');
  });

  it('loops batches until a partial batch is returned', async () => {
    const batch = Array.from({ length: 50 }, (_, index) => ({
      id: `tx-${index}`,
      bookingId: `booking-${index}`,
      provider: PaymentProvider.STRIPE,
      status: TransactionStatus.PENDING,
      providerMeta: { pendingProviderSessionId: `cs_${index}` },
    }));

    prisma.transaction.findMany.mockResolvedValueOnce(batch).mockResolvedValueOnce([batch[0]]);

    await expect(
      service.reconcileOrphanPendingPayments(new Date('2026-01-01T12:00:00Z'), 50, 100),
    ).resolves.toBe(51);
  });
});
