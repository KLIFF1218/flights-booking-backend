import { BookingStatus, TransactionStatus } from '@prisma/client';
import {
  isBookingExpiredOrCanceled,
  isBookingPaymentPending,
} from './payment-booking.policy';
import {
  isAbandonableTransactionStatus,
  isTransactionTerminalFailure,
  isTransactionSucceeded,
} from './payment-transaction.policy';

export function shouldReconcileLateSuccess(
  webhookStatus: TransactionStatus,
  transactionStatus: TransactionStatus,
  bookingStatus: BookingStatus,
): boolean {
  return (
    webhookStatus === TransactionStatus.SUCCEED &&
    transactionStatus === TransactionStatus.CANCELED &&
    isBookingExpiredOrCanceled(bookingStatus)
  );
}

export function shouldIgnoreWebhookAsAlreadySucceeded(transactionStatus: TransactionStatus): boolean {
  return isTransactionSucceeded(transactionStatus);
}

export function shouldIgnoreWebhookAsAlreadyFinalized(
  webhookStatus: TransactionStatus,
  transactionStatus: TransactionStatus,
  bookingStatus: BookingStatus,
): boolean {
  return (
    isTransactionTerminalFailure(transactionStatus) &&
    !shouldReconcileLateSuccess(webhookStatus, transactionStatus, bookingStatus)
  );
}

export function requiresLateSuccessReconciliation(bookingStatus: BookingStatus): boolean {
  return isBookingExpiredOrCanceled(bookingStatus);
}

export function canAbandonPayment(
  bookingStatus: BookingStatus,
  transactionStatus: TransactionStatus | undefined,
): boolean {
  return (
    isBookingPaymentPending(bookingStatus) &&
    transactionStatus !== undefined &&
    isAbandonableTransactionStatus(transactionStatus)
  );
}
