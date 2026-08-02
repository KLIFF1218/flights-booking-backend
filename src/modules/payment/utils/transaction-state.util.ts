import { type Prisma, TransactionStatus } from '@prisma/client';
import {
  ABANDONABLE_TRANSACTION_STATUSES,
  SUCCEEDABLE_TRANSACTION_STATUSES,
  isAbandonableTransactionStatus,
} from '../domain/payment-transaction.policy';

type TransactionDbClient = Pick<Prisma.TransactionClient, 'transaction'>;

export { isAbandonableTransactionStatus };

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
