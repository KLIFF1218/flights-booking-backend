import { BookingStatus, TransactionStatus } from '@prisma/client';
import {
  canAbandonPayment,
  requiresLateSuccessReconciliation,
  shouldIgnoreWebhookAsAlreadyFinalized,
  shouldIgnoreWebhookAsAlreadySucceeded,
  shouldReconcileLateSuccess,
} from './payment-webhook.policy';
import {
  canStartCheckoutPayment,
  isBookingExpiredOrCanceled,
  isBookingPaymentPending,
} from './payment-booking.policy';

describe('payment-webhook.policy', () => {
  it('detects late-success reconciliation path', () => {
    expect(
      shouldReconcileLateSuccess(
        TransactionStatus.SUCCEED,
        TransactionStatus.CANCELED,
        BookingStatus.EXPIRED,
      ),
    ).toBe(true);

    expect(
      shouldReconcileLateSuccess(
        TransactionStatus.CANCELED,
        TransactionStatus.CANCELED,
        BookingStatus.EXPIRED,
      ),
    ).toBe(false);
  });

  it('ignores duplicate success webhooks', () => {
    expect(shouldIgnoreWebhookAsAlreadySucceeded(TransactionStatus.SUCCEED)).toBe(true);
    expect(shouldIgnoreWebhookAsAlreadySucceeded(TransactionStatus.PENDING)).toBe(false);
  });

  it('ignores finalized transactions unless late success applies', () => {
    expect(
      shouldIgnoreWebhookAsAlreadyFinalized(
        TransactionStatus.CANCELED,
        TransactionStatus.CANCELED,
        BookingStatus.EXPIRED,
      ),
    ).toBe(true);

    expect(
      shouldIgnoreWebhookAsAlreadyFinalized(
        TransactionStatus.SUCCEED,
        TransactionStatus.CANCELED,
        BookingStatus.EXPIRED,
      ),
    ).toBe(false);
  });

  it('requires late-success reconciliation for expired or canceled bookings', () => {
    expect(requiresLateSuccessReconciliation(BookingStatus.EXPIRED)).toBe(true);
    expect(requiresLateSuccessReconciliation(BookingStatus.PAYMENT_PENDING)).toBe(false);
  });

  it('allows payment abandonment only for payable bookings with abandonable transactions', () => {
    expect(
      canAbandonPayment(BookingStatus.PAYMENT_PENDING, TransactionStatus.PENDING),
    ).toBe(true);
    expect(canAbandonPayment(BookingStatus.PAID, TransactionStatus.PENDING)).toBe(false);
    expect(canAbandonPayment(BookingStatus.PAYMENT_PENDING, TransactionStatus.SUCCEED)).toBe(
      false,
    );
  });
});

describe('payment-booking.policy', () => {
  it('identifies checkout and payment-pending booking states', () => {
    expect(canStartCheckoutPayment(BookingStatus.SEATS_SELECTED)).toBe(true);
    expect(isBookingPaymentPending(BookingStatus.PAYMENT_PENDING)).toBe(true);
    expect(isBookingExpiredOrCanceled(BookingStatus.EXPIRED)).toBe(true);
  });
});
