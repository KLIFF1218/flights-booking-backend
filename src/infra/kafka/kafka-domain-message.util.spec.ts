import { DOMAIN_EVENT_SCHEMA_VERSION } from './domain-event.constants';
import { normalizeDomainEventEnvelope, parseKafkaMessageJson } from './kafka-domain-message.util';

describe('kafka-domain-message.util', () => {
  describe('parseKafkaMessageJson', () => {
    it('returns null for empty raw values', () => {
      expect(parseKafkaMessageJson(undefined)).toBeNull();
      expect(parseKafkaMessageJson('')).toBeNull();
    });

    it('parses valid JSON', () => {
      expect(parseKafkaMessageJson('{"bookingId":"b1"}')).toEqual({ bookingId: 'b1' });
    });

    it('returns null for malformed JSON', () => {
      expect(parseKafkaMessageJson('{not-json')).toBeNull();
    });
  });

  describe('normalizeDomainEventEnvelope', () => {
    it('returns parsed envelope when payload is already normalized', () => {
      const envelope = {
        eventId: 'evt-1',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
        payload: { bookingId: 'booking-1' },
      };

      expect(normalizeDomainEventEnvelope('booking.paid', envelope, '42')).toEqual(envelope);
    });

    it('wraps legacy payload-only kafka messages', () => {
      const result = normalizeDomainEventEnvelope(
        'payment.failed',
        {
          bookingId: 'booking-9',
          userId: 'user-1',
          occurredAt: '2026-07-26T12:00:00.000Z',
        },
        '99',
      );

      expect(result).toEqual({
        eventId: 'legacy:payment.failed:99',
        eventType: 'payment.failed',
        aggregateType: 'Booking',
        aggregateId: 'booking-9',
        occurredAt: '2026-07-26T12:00:00.000Z',
        schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
        correlationId: 'booking-9',
        payload: {
          bookingId: 'booking-9',
          userId: 'user-1',
          occurredAt: '2026-07-26T12:00:00.000Z',
        },
      });
    });
  });
});
