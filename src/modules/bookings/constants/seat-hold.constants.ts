/** Seat holds loaded per batch when resyncing expired hold TTLs. */
export const RELEASE_EXPIRED_HOLDS_BATCH_SIZE = 500;

/** Safety cap: up to 10_000 holds per scheduler run. */
export const RELEASE_EXPIRED_HOLDS_MAX_BATCHES_PER_RUN = 20;
