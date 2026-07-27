import { DOMAIN_EVENT_SCHEMA_VERSION } from './domain-event.constants';
import {
  parseDomainEventEnvelope,
  type DomainEventEnvelope,
} from './domain-event-envelope.util';

export function parseKafkaMessageJson(raw: string | undefined): unknown | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function normalizeDomainEventEnvelope(
  topic: string,
  parsed: unknown,
  offset: string,
): DomainEventEnvelope {
  const envelope = parseDomainEventEnvelope(parsed);
  if (envelope) {
    return envelope;
  }

  const payload =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};

  const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : '';
  const occurredAt =
    typeof payload.occurredAt === 'string'
      ? payload.occurredAt
      : typeof payload.issuedAt === 'string'
        ? payload.issuedAt
        : new Date().toISOString();

  return {
    eventId: `legacy:${topic}:${offset}`,
    eventType: topic,
    aggregateType: bookingId ? 'Booking' : 'Unknown',
    aggregateId: bookingId || topic,
    occurredAt,
    schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
    correlationId: bookingId || undefined,
    payload,
  };
}
