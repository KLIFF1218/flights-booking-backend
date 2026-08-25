import { BookingStatus } from '@prisma/client';

export const BOOKING_DETAIL_STABLE_TTL_SECONDS = 30 * 60;
export const BOOKING_DETAIL_IN_PROGRESS_TTL_SECONDS = 5 * 60;

const NON_CACHEABLE_DETAIL_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.PAID,
  BookingStatus.TICKETING,
];

const IN_PROGRESS_DETAIL_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PNR_CREATED,
  BookingStatus.SEATS_SELECTED,
];

export function resolveBookingDetailCacheTtl(status: BookingStatus): number | null {
  if (NON_CACHEABLE_DETAIL_STATUSES.includes(status)) {
    return null;
  }

  if (IN_PROGRESS_DETAIL_STATUSES.includes(status)) {
    return BOOKING_DETAIL_IN_PROGRESS_TTL_SECONDS;
  }

  return BOOKING_DETAIL_STABLE_TTL_SECONDS;
}
