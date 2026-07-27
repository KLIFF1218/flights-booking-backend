import {
  isTicketingUnrecoverableError,
  TicketingErrorCode,
  TicketingUnrecoverableError,
} from './ticketing.errors';

describe('ticketing.errors', () => {
  it('identifies TicketingUnrecoverableError instances', () => {
    const error = new TicketingUnrecoverableError(
      'Pricing not found',
      TicketingErrorCode.PRICING_NOT_FOUND,
      'booking-1',
    );

    expect(isTicketingUnrecoverableError(error)).toBe(true);
    expect(error.code).toBe(TicketingErrorCode.PRICING_NOT_FOUND);
    expect(error.bookingId).toBe('booking-1');
  });

  it('returns false for generic errors', () => {
    expect(isTicketingUnrecoverableError(new Error('boom'))).toBe(false);
    expect(isTicketingUnrecoverableError(null)).toBe(false);
  });
});
