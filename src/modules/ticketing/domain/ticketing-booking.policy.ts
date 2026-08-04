import { BookingStatus } from '@prisma/client';

export const TICKETING_ELIGIBLE_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.TICKETING,
];

export const TICKETING_MARK_TICKETED_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.TICKETING,
];

export function isEligibleForTicketing(status: BookingStatus): boolean {
  return TICKETING_ELIGIBLE_STATUSES.includes(status);
}
