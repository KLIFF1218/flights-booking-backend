/** Batch size per scheduler run for stale payment abandonment. */
export const PAYMENT_ABANDON_BATCH_SIZE = 100;

/** Safety cap: up to 10_000 abandonments per scheduler run. */
export const PAYMENT_ABANDON_MAX_BATCHES_PER_RUN = 100;

/** Batch size per scheduler run for orphan pending reconciliation. */
export const ORPHAN_PENDING_BATCH_SIZE = 50;

/** Safety cap: up to 5_000 orphan reconciliations per scheduler run. */
export const ORPHAN_PENDING_MAX_BATCHES_PER_RUN = 100;
