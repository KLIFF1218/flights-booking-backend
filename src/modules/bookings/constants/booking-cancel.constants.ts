import { BookingStatus } from '@prisma/client';

export const USER_CANCELLABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PNR_CREATED,
  BookingStatus.SEATS_SELECTED,
  BookingStatus.PAYMENT_PENDING,
];

export const USER_NON_CANCELLABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.TICKETING,
  BookingStatus.TICKETED,
  BookingStatus.EXPIRED,
];
