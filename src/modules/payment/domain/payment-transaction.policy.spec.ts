import { TransactionStatus } from '@prisma/client';
import {
  canFinalizeTransactionToSucceed,
  canTransitionTransactionTo,
  hasActivePaymentSession,
  isAbandonableTransactionStatus,
  isTransactionSucceeded,
  isTransactionTerminalFailure,
} from './payment-transaction.policy';

describe('payment-transaction.policy', () => {
  it('identifies abandonable transaction statuses', () => {
    expect(isAbandonableTransactionStatus(TransactionStatus.PENDING)).toBe(true);
    expect(isAbandonableTransactionStatus(TransactionStatus.AUTHORIZED)).toBe(true);
    expect(isAbandonableTransactionStatus(TransactionStatus.SUCCEED)).toBe(false);
  });

  it('identifies active payment sessions', () => {
    expect(hasActivePaymentSession(TransactionStatus.PENDING)).toBe(true);
    expect(hasActivePaymentSession(TransactionStatus.CANCELED)).toBe(false);
    expect(hasActivePaymentSession(TransactionStatus.FAILED)).toBe(false);
  });

  it('allows succeed transitions from pending or authorized', () => {
    expect(canFinalizeTransactionToSucceed(TransactionStatus.PENDING)).toBe(true);
    expect(canFinalizeTransactionToSucceed(TransactionStatus.AUTHORIZED)).toBe(true);
    expect(canFinalizeTransactionToSucceed(TransactionStatus.CANCELED)).toBe(false);
  });

  it('evaluates transition matrix', () => {
    expect(
      canTransitionTransactionTo(TransactionStatus.PENDING, TransactionStatus.AUTHORIZED),
    ).toBe(true);
    expect(
      canTransitionTransactionTo(TransactionStatus.PENDING, TransactionStatus.SUCCEED),
    ).toBe(true);
    expect(
      canTransitionTransactionTo(TransactionStatus.SUCCEED, TransactionStatus.CANCELED),
    ).toBe(false);
  });

  it('identifies terminal failure and success states', () => {
    expect(isTransactionSucceeded(TransactionStatus.SUCCEED)).toBe(true);
    expect(isTransactionTerminalFailure(TransactionStatus.FAILED)).toBe(true);
    expect(isTransactionTerminalFailure(TransactionStatus.CANCELED)).toBe(true);
  });
});
