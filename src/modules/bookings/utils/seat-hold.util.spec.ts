import { resolveSeatHoldExpiresAt } from './seat-hold.util';

describe('resolveSeatHoldExpiresAt', () => {
  it('uses booking expiration as seat hold expiration', () => {
    const bookingExpiresAt = new Date('2026-01-01T12:30:00Z');

    expect(resolveSeatHoldExpiresAt(bookingExpiresAt)).toEqual(bookingExpiresAt);
  });
});
