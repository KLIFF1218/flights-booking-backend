import { BookingStatus } from '@prisma/client';
import {
  BOOKING_DETAIL_IN_PROGRESS_TTL_SECONDS,
  BOOKING_DETAIL_STABLE_TTL_SECONDS,
  resolveBookingDetailCacheTtl,
} from './booking-cache.util';

describe('booking-cache.util', () => {
  it('skips cache for payment lifecycle statuses', () => {
    expect(resolveBookingDetailCacheTtl(BookingStatus.PAYMENT_PENDING)).toBeNull();
    expect(resolveBookingDetailCacheTtl(BookingStatus.PAID)).toBeNull();
    expect(resolveBookingDetailCacheTtl(BookingStatus.TICKETING)).toBeNull();
  });

  it('uses shorter ttl for in-progress bookings', () => {
    expect(resolveBookingDetailCacheTtl(BookingStatus.PNR_CREATED)).toBe(
      BOOKING_DETAIL_IN_PROGRESS_TTL_SECONDS,
    );
    expect(resolveBookingDetailCacheTtl(BookingStatus.SEATS_SELECTED)).toBe(
      BOOKING_DETAIL_IN_PROGRESS_TTL_SECONDS,
    );
  });

  it('uses stable ttl for finalized bookings', () => {
    expect(resolveBookingDetailCacheTtl(BookingStatus.TICKETED)).toBe(
      BOOKING_DETAIL_STABLE_TTL_SECONDS,
    );
    expect(resolveBookingDetailCacheTtl(BookingStatus.CANCELED)).toBe(
      BOOKING_DETAIL_STABLE_TTL_SECONDS,
    );
  });
});
