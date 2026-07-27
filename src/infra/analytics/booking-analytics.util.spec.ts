import { incrementsForEventType, isAnalyticsEventType } from './booking-analytics.util';

describe('booking-analytics.util', () => {
  it('recognizes analytics event types', () => {
    expect(isAnalyticsEventType('booking.paid')).toBe(true);
    expect(isAnalyticsEventType('booking.expired')).toBe(true);
    expect(isAnalyticsEventType('booking.ticketing.failed')).toBe(true);
    expect(isAnalyticsEventType('flight.delayed')).toBe(true);
    expect(isAnalyticsEventType('unknown.event')).toBe(false);
  });

  it('maps booking.paid increments with payment volume', () => {
    const increments = incrementsForEventType('booking.paid', 15000);

    expect(increments.paymentsSucceeded).toBe(1);
    expect(increments.paymentVolume).toBe(15000);
    expect(increments.bookingsCreated).toBe(0);
  });

  it('maps booking.expired separately from booking.canceled', () => {
    expect(incrementsForEventType('booking.expired').bookingsExpired).toBe(1);
    expect(incrementsForEventType('booking.expired').bookingsCanceled).toBe(0);
    expect(incrementsForEventType('booking.canceled').bookingsCanceled).toBe(1);
    expect(incrementsForEventType('booking.canceled').bookingsExpired).toBe(0);
  });

  it('maps booking.ticketing.failed', () => {
    expect(incrementsForEventType('booking.ticketing.failed').ticketingFailed).toBe(1);
  });
});
