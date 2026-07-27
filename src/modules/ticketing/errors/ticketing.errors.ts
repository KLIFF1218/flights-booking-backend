import { UnrecoverableError } from 'bullmq';

export const TicketingErrorCode = {
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  SNAPSHOT_MISSING: 'SNAPSHOT_MISSING',
  NO_TRAVELERS: 'NO_TRAVELERS',
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
  INCOMPLETE_ISSUANCE: 'INCOMPLETE_ISSUANCE',
} as const;

export type TicketingErrorCode = (typeof TicketingErrorCode)[keyof typeof TicketingErrorCode];

/** Permanent ticketing failure — BullMQ must not retry the job. */
export class TicketingUnrecoverableError extends UnrecoverableError {
  constructor(
    message: string,
    readonly code: TicketingErrorCode,
    readonly bookingId?: string,
  ) {
    super(message);
    this.name = 'TicketingUnrecoverableError';
  }
}

export function isTicketingUnrecoverableError(
  error: unknown,
): error is TicketingUnrecoverableError {
  return error instanceof TicketingUnrecoverableError;
}
