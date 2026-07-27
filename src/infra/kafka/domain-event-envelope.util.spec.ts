import { DOMAIN_EVENT_SCHEMA_VERSION } from './domain-event.constants';
import {
  buildDomainEventEnvelope,
  parseDomainEventEnvelope,
  resolveBookingIdFromEnvelope,
  resolveDomainEventPartitionKey,
} from './domain-event-envelope.util';

describe('domain-event-envelope.util', () => {
  const baseMessage = {
    id: 'outbox-1',
    topic: 'booking.paid',
    aggregateId: 'booking-1',
    aggregateType: 'Booking',
    key: 'booking-1',
    payload: {
      bookingId: 'booking-1',
      userId: 'user-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
    },
  };

  describe('buildDomainEventEnvelope', () => {
    it('maps outbox message to a domain event envelope', () => {
      expect(buildDomainEventEnvelope(baseMessage)).toEqual({
        eventId: 'outbox-1',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
        correlationId: 'booking-1',
        payload: baseMessage.payload,
      });
    });

    it('falls back to issuedAt and defaults when fields are missing', () => {
      const envelope = buildDomainEventEnvelope({
        id: 'outbox-2',
        topic: 'ticket.issued',
        aggregateId: null,
        aggregateType: null,
        key: null,
        payload: { issuedAt: '2026-07-26T11:00:00.000Z' },
      });

      expect(envelope.aggregateType).toBe('Booking');
      expect(envelope.aggregateId).toBe('');
      expect(envelope.occurredAt).toBe('2026-07-26T11:00:00.000Z');
      expect(envelope.correlationId).toBeUndefined();
    });
  });

  describe('resolveDomainEventPartitionKey', () => {
    it('prefers bookingId from payload', () => {
      expect(resolveDomainEventPartitionKey(baseMessage)).toBe('booking-1');
    });

    it('falls back to aggregateId for booking aggregate', () => {
      expect(
        resolveDomainEventPartitionKey({
          ...baseMessage,
          payload: {},
        }),
      ).toBe('booking-1');
    });

    it('uses message key as last resort', () => {
      expect(
        resolveDomainEventPartitionKey({
          id: 'outbox-3',
          topic: 'custom.event',
          aggregateId: null,
          aggregateType: 'Payment',
          key: 'partition-key',
          payload: {},
        }),
      ).toBe('partition-key');
    });
  });

  describe('resolveBookingIdFromEnvelope', () => {
    it('returns aggregateId for booking aggregate', () => {
      expect(
        resolveBookingIdFromEnvelope({
          eventId: 'evt-1',
          eventType: 'booking.paid',
          aggregateType: 'Booking',
          aggregateId: 'booking-1',
          occurredAt: '2026-07-26T10:00:00.000Z',
          schemaVersion: 1,
          payload: {},
        }),
      ).toBe('booking-1');
    });

    it('reads bookingId from payload for non-booking aggregate', () => {
      expect(
        resolveBookingIdFromEnvelope({
          eventId: 'evt-2',
          eventType: 'payment.failed',
          aggregateType: 'Payment',
          aggregateId: 'payment-1',
          occurredAt: '2026-07-26T10:00:00.000Z',
          schemaVersion: 1,
          payload: { bookingId: 'booking-9' },
        }),
      ).toBe('booking-9');
    });
  });

  describe('parseDomainEventEnvelope', () => {
    it('parses a valid envelope', () => {
      expect(
        parseDomainEventEnvelope({
          eventId: 'evt-1',
          eventType: 'booking.created',
          aggregateType: 'Booking',
          aggregateId: 'booking-1',
          occurredAt: '2026-07-26T10:00:00.000Z',
          schemaVersion: 2,
          correlationId: 'booking-1',
          payload: { bookingId: 'booking-1' },
        }),
      ).toEqual({
        eventId: 'evt-1',
        eventType: 'booking.created',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 2,
        correlationId: 'booking-1',
        payload: { bookingId: 'booking-1' },
      });
    });

    it('returns null for invalid payloads', () => {
      expect(parseDomainEventEnvelope(null)).toBeNull();
      expect(parseDomainEventEnvelope({ eventId: 'only-id' })).toBeNull();
    });
  });
});
