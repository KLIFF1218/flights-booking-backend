import { retryWithExponentialBackoff } from './retry-with-backoff.util';

describe('retryWithExponentialBackoff', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(retryWithExponentialBackoff(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('ok');

    await expect(
      retryWithExponentialBackoff(fn, { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 2 }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws last error after max attempts', async () => {
    const error = new Error('persistent');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      retryWithExponentialBackoff(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
