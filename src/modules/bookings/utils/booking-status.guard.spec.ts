import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertBookingStatusAllows, BookingOperation } from './booking-status.guard';

describe('assertBookingStatusAllows', () => {
  it('allows addTravelers only in PNR_CREATED', () => {
    expect(() =>
      assertBookingStatusAllows(BookingStatus.PNR_CREATED, BookingOperation.ADD_TRAVELERS),
    ).not.toThrow();
  });

  it.each([
    BookingStatus.SEATS_SELECTED,
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAID,
    BookingStatus.TICKETED,
    BookingStatus.CANCELED,
  ])('rejects addTravelers in %s', (status) => {
    expect(() => assertBookingStatusAllows(status, BookingOperation.ADD_TRAVELERS)).toThrow(
      BadRequestException,
    );
  });

  it.each([BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED])(
    'allows assignSeats in %s',
    (status) => {
      expect(() => assertBookingStatusAllows(status, BookingOperation.ASSIGN_SEATS)).not.toThrow();
    },
  );

  it.each([
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAID,
    BookingStatus.TICKETED,
    BookingStatus.CANCELED,
  ])('rejects assignSeats in %s', (status) => {
    expect(() => assertBookingStatusAllows(status, BookingOperation.ASSIGN_SEATS)).toThrow(
      BadRequestException,
    );
  });

  it.each([BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED])(
    'allows checkout in %s',
    (status) => {
      expect(() => assertBookingStatusAllows(status, BookingOperation.CHECKOUT)).not.toThrow();
    },
  );

  it.each([
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAID,
    BookingStatus.TICKETED,
    BookingStatus.CANCELED,
  ])('rejects checkout in %s', (status) => {
    expect(() => assertBookingStatusAllows(status, BookingOperation.CHECKOUT)).toThrow(
      BadRequestException,
    );
  });
});
