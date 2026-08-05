import { TransactionStatus } from '@prisma/client';

export const ABANDONABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.AUTHORIZED,
];

export const SUCCEEDABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.AUTHORIZED,
];

export const TERMINAL_TRANSACTION_FAILURE_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.CANCELED,
  TransactionStatus.FAILED,
];

export function isAbandonableTransactionStatus(status: TransactionStatus): boolean {
  return ABANDONABLE_TRANSACTION_STATUSES.includes(status);
}

export function canFinalizeTransactionToSucceed(status: TransactionStatus): boolean {
  return SUCCEEDABLE_TRANSACTION_STATUSES.includes(status);
}

export function isTransactionSucceeded(status: TransactionStatus): boolean {
  return status === TransactionStatus.SUCCEED;
}

export function isTransactionTerminalFailure(status: TransactionStatus): boolean {
  return TERMINAL_TRANSACTION_FAILURE_STATUSES.includes(status);
}

export function hasActivePaymentSession(status: TransactionStatus): boolean {
  return !isTransactionTerminalFailure(status);
}

export function canTransitionTransactionTo(
  currentStatus: TransactionStatus,
  targetStatus: TransactionStatus,
): boolean {
  if (currentStatus === targetStatus) {
    return false;
  }

  switch (targetStatus) {
    case TransactionStatus.AUTHORIZED:
      return currentStatus === TransactionStatus.PENDING;
    case TransactionStatus.SUCCEED:
      return canFinalizeTransactionToSucceed(currentStatus);
    case TransactionStatus.CANCELED:
      return isAbandonableTransactionStatus(currentStatus);
    case TransactionStatus.FAILED:
      return currentStatus === TransactionStatus.PENDING;
    default:
      return false;
  }
}
