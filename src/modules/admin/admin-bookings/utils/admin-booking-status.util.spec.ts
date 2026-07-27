import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertAdminBookingStatusTransition } from './admin-booking-status.util';

describe('assertAdminBookingStatusTransition', () => {
  it('allows idempotent status update', () => {
    expect(() =>
      assertAdminBookingStatusTransition(BookingStatus.PAID, BookingStatus.PAID),
    ).not.toThrow();
  });

  it('allows paid to ticketing transition', () => {
    expect(() =>
      assertAdminBookingStatusTransition(BookingStatus.PAID, BookingStatus.TICKETING),
    ).not.toThrow();
  });

  it('rejects dangerous lifecycle transitions', () => {
    expect(() =>
      assertAdminBookingStatusTransition(BookingStatus.CANCELED, BookingStatus.PAID),
    ).toThrow(BadRequestException);
  });
});
