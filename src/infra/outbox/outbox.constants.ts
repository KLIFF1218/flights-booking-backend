export const OUTBOX_MAX_ATTEMPTS = 10;
export const OUTBOX_BASE_RETRY_DELAY_MS = 5_000;
export const OUTBOX_MAX_RETRY_DELAY_MS = 5 * 60_000;
export const OUTBOX_STALE_PROCESSING_MS = 5 * 60_000;

export function calculateOutboxRetryDelayMs(attempts: number): number {
  const exponent = Math.max(attempts - 1, 0);
  return Math.min(OUTBOX_BASE_RETRY_DELAY_MS * 2 ** exponent, OUTBOX_MAX_RETRY_DELAY_MS);
}
