function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 200;
  const maxDelayMs = options?.maxDelayMs ?? 5_000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
