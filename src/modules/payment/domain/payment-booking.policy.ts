import { BookingStatus } from '@prisma/client';

export function isBookingExpiredOrCanceled(status: BookingStatus): boolean {
  return status === BookingStatus.EXPIRED || status === BookingStatus.CANCELED;
}

export function isBookingPaymentPending(status: BookingStatus): boolean {
  return status === BookingStatus.PAYMENT_PENDING;
}

export function canStartCheckoutPayment(status: BookingStatus): boolean {
  return status === BookingStatus.SEATS_SELECTED;
}

export function isBookingPayable(status: BookingStatus): boolean {
  return isBookingPaymentPending(status);
}
