import { BookingStatus } from '@prisma/client';

export const BOOKING_EXPIRATION_MINUTES = 30;

/** Grace period after redirect to payment provider (separate from booking TTL). */
export const PAYMENT_GRACE_MINUTES = 15;

export const EXPIRATION_BATCH_SIZE = 100;

/** Safety cap: up to 10_000 expirations per scheduler run. */
export const EXPIRATION_MAX_BATCHES_PER_RUN = 100;

export const EXPIRABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PNR_CREATED,
  BookingStatus.SEATS_SELECTED,
];
