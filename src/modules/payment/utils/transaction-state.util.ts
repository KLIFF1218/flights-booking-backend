import { BookingStatus, type Prisma, TransactionStatus } from '@prisma/client';

type TransactionDbClient = Pick<Prisma.TransactionClient, 'transaction' | 'booking'>;

const ABANDONABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.AUTHORIZED,
];

const SUCCEEDABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.AUTHORIZED,
];

export async function finalizeTransactionIfPending(
  client: TransactionDbClient,
  transactionId: string,
  data: Prisma.TransactionUpdateManyMutationInput,
): Promise<boolean> {
  const result = await client.transaction.updateMany({
    where: {
      id: transactionId,
      status: TransactionStatus.PENDING,
    },
    data,
  });

  return result.count === 1;
}

/** PENDING or AUTHORIZED → SUCCEED (YooKassa two-stage capture). */
export async function finalizeTransactionToSucceed(
  client: TransactionDbClient,
  transactionId: string,
  data: Omit<Prisma.TransactionUpdateManyMutationInput, 'status'>,
): Promise<boolean> {
  const result = await client.transaction.updateMany({
    where: {
      id: transactionId,
      status: { in: [...SUCCEEDABLE_TRANSACTION_STATUSES] },
    },
    data: {
      ...data,
      status: TransactionStatus.SUCCEED,
    },
  });

  return result.count === 1;
}

export async function markTransactionAuthorizedIfPending(
  client: TransactionDbClient,
  transactionId: string,
  data: Omit<Prisma.TransactionUpdateManyMutationInput, 'status'> = {},
): Promise<boolean> {
  const result = await client.transaction.updateMany({
    where: {
      id: transactionId,
      status: TransactionStatus.PENDING,
    },
    data: {
      ...data,
      status: TransactionStatus.AUTHORIZED,
    },
  });

  return result.count === 1;
}

export async function markBookingPaidIfPending(
  client: TransactionDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.PAID,
    },
  });

  return result.count === 1;
}

export async function markBookingCanceledIfPaymentPending(
  client: TransactionDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.CANCELED,
    },
  });

  return result.count === 1;
}

export async function cancelTransactionIfPending(
  client: TransactionDbClient,
  transactionId: string,
): Promise<boolean> {
  const result = await client.transaction.updateMany({
    where: {
      id: transactionId,
      status: TransactionStatus.PENDING,
    },
    data: {
      status: TransactionStatus.CANCELED,
    },
  });

  return result.count === 1;
}

/** PENDING or AUTHORIZED → CANCELED (payment abandon / rollback). */
export async function cancelTransactionIfAbandonable(
  client: TransactionDbClient,
  transactionId: string,
): Promise<boolean> {
  const result = await client.transaction.updateMany({
    where: {
      id: transactionId,
      status: { in: [...ABANDONABLE_TRANSACTION_STATUSES] },
    },
    data: {
      status: TransactionStatus.CANCELED,
    },
  });

  return result.count === 1;
}

export async function markBookingExpiredIfPaymentPending(
  client: TransactionDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.EXPIRED,
    },
  });

  return result.count === 1;
}

export function isAbandonableTransactionStatus(status: TransactionStatus): boolean {
  return ABANDONABLE_TRANSACTION_STATUSES.includes(status);
}
