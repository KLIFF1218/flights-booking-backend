import { DOMAIN_EVENT_SCHEMA_VERSION } from './domain-event.constants';

export type DomainEventEnvelope<T = Record<string, unknown>> = {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  schemaVersion: number;
  correlationId?: string;
  payload: T;
};

type OutboxMessageLike = {
  id: string;
  topic: string;
  aggregateId: string | null;
  aggregateType: string | null;
  key: string | null;
  payload: unknown;
};

export function buildDomainEventEnvelope(msg: OutboxMessageLike): DomainEventEnvelope {
  const payload =
    msg.payload && typeof msg.payload === 'object' ? (msg.payload as Record<string, unknown>) : {};

  const occurredAt =
    typeof payload.occurredAt === 'string'
      ? payload.occurredAt
      : typeof payload.issuedAt === 'string'
        ? payload.issuedAt
        : new Date().toISOString();

  return {
    eventId: msg.id,
    eventType: msg.topic,
    aggregateType: msg.aggregateType ?? 'Booking',
    aggregateId: msg.aggregateId ?? '',
    occurredAt,
    schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
    correlationId: resolveDomainEventCorrelationId(msg, payload),
    payload,
  };
}

export function resolveDomainEventPartitionKey(msg: OutboxMessageLike): string | undefined {
  const payload =
    msg.payload && typeof msg.payload === 'object'
      ? (msg.payload as Record<string, unknown>)
      : undefined;

  if (typeof payload?.bookingId === 'string') {
    return payload.bookingId;
  }

  if (msg.aggregateType === 'Booking' && msg.aggregateId) {
    return msg.aggregateId;
  }

  return msg.key ?? msg.aggregateId ?? undefined;
}

export function resolveBookingIdFromEnvelope(envelope: DomainEventEnvelope): string | null {
  if (envelope.aggregateType === 'Booking' && envelope.aggregateId) {
    return envelope.aggregateId;
  }

  const bookingId = envelope.payload.bookingId;
  return typeof bookingId === 'string' ? bookingId : null;
}

export function parseDomainEventEnvelope(value: unknown): DomainEventEnvelope | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<DomainEventEnvelope>;

  if (
    typeof candidate.eventId !== 'string' ||
    typeof candidate.eventType !== 'string' ||
    typeof candidate.aggregateType !== 'string' ||
    typeof candidate.aggregateId !== 'string' ||
    typeof candidate.occurredAt !== 'string' ||
    !candidate.payload ||
    typeof candidate.payload !== 'object'
  ) {
    return null;
  }

  return {
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    aggregateType: candidate.aggregateType,
    aggregateId: candidate.aggregateId,
    occurredAt: candidate.occurredAt,
    schemaVersion:
      typeof candidate.schemaVersion === 'number'
        ? candidate.schemaVersion
        : DOMAIN_EVENT_SCHEMA_VERSION,
    correlationId:
      typeof candidate.correlationId === 'string' ? candidate.correlationId : undefined,
    payload: candidate.payload,
  };
}

function resolveDomainEventCorrelationId(
  msg: OutboxMessageLike,
  payload: Record<string, unknown>,
): string | undefined {
  if (typeof payload.bookingId === 'string') {
    return payload.bookingId;
  }

  if (msg.aggregateType === 'Booking' && msg.aggregateId) {
    return msg.aggregateId;
  }

  return msg.key ?? undefined;
}
