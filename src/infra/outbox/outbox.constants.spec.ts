import { calculateOutboxRetryDelayMs, OUTBOX_MAX_ATTEMPTS } from './outbox.constants';

describe('outbox.constants', () => {
  it('should calculate exponential backoff with a cap', () => {
    expect(calculateOutboxRetryDelayMs(1)).toBe(5_000);
    expect(calculateOutboxRetryDelayMs(2)).toBe(10_000);
    expect(calculateOutboxRetryDelayMs(3)).toBe(20_000);
    expect(calculateOutboxRetryDelayMs(10)).toBe(300_000);
  });

  it('should define a max attempts budget', () => {
    expect(OUTBOX_MAX_ATTEMPTS).toBeGreaterThan(1);
  });
});
