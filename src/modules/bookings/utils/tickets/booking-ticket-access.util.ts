import { BookingStatus } from '@prisma/client';

export const TICKET_AVAILABLE_STATUSES: readonly BookingStatus[] = [
  BookingStatus.TICKETING,
  BookingStatus.TICKETED,
];

export function canAccessBookingTickets(status: BookingStatus): boolean {
  return TICKET_AVAILABLE_STATUSES.includes(status);
}
