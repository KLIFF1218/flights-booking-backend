export const BOOKING_PAYMENT_SEAT_RELEASE_REASON = {
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_CANCELED: 'payment_canceled',
  PAYMENT_ABANDONED: 'payment_abandoned',
  TICKETING_FAILED: 'ticketing_failed',
} as const;

export type BookingPaymentSeatReleaseReason =
  (typeof BOOKING_PAYMENT_SEAT_RELEASE_REASON)[keyof typeof BOOKING_PAYMENT_SEAT_RELEASE_REASON];
