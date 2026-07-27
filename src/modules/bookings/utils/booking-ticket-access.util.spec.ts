import { BookingStatus } from '@prisma/client';
import { canAccessBookingTickets } from './booking-ticket-access.util';

describe('canAccessBookingTickets', () => {
  it.each([BookingStatus.TICKETING, BookingStatus.TICKETED])(
    'allows ticket access for %s',
    (status) => {
      expect(canAccessBookingTickets(status)).toBe(true);
    },
  );

  it.each([
    BookingStatus.PNR_CREATED,
    BookingStatus.SEATS_SELECTED,
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAID,
    BookingStatus.CANCELED,
    BookingStatus.EXPIRED,
  ])('denies ticket access for %s', (status) => {
    expect(canAccessBookingTickets(status)).toBe(false);
  });
});
