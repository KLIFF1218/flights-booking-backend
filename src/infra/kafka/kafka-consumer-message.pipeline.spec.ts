import { normalizeDomainEventEnvelope, parseKafkaMessageJson } from './kafka-domain-message.util';
import type { BookingNotificationsService } from 'src/infra/notifications/booking-notifications.service';
import type { DomainAnalyticsService } from 'src/infra/analytics/domain-analytics.service';
import type { DomainEventsService } from 'src/infra/domain-events/domain-events.service';

async function processKafkaConsumerMessage<T>(
  raw: string | undefined,
  topic: string,
  offset: string,
  handler: (envelope: ReturnType<typeof normalizeDomainEventEnvelope>) => Promise<T>,
): Promise<T | null> {
  const parsed = parseKafkaMessageJson(raw);
  if (parsed === null) {
    return null;
  }

  const envelope = normalizeDomainEventEnvelope(topic, parsed, offset);
  return handler(envelope);
}

describe('Kafka consumer message pipeline', () => {
  it('notifications consumer delegates normalized envelope to service', async () => {
    const notifications = {
      handleDomainEvent: jest.fn().mockResolvedValue('created'),
    } as unknown as BookingNotificationsService;

    const result = await processKafkaConsumerMessage(
      JSON.stringify({
        eventId: 'evt-1',
        eventType: 'ticket.issued',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-1', userId: 'user-1' },
      }),
      'ticket.issued',
      '15',
      (envelope) => notifications.handleDomainEvent(envelope),
    );

    expect(result).toBe('created');
    expect(notifications.handleDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ticket.issued',
        aggregateId: 'booking-1',
      }),
    );
  });

  it('analytics consumer applies normalized envelope', async () => {
    const analytics = {
      applyDomainEvent: jest.fn().mockResolvedValue('applied'),
    } as unknown as DomainAnalyticsService;

    const result = await processKafkaConsumerMessage(
      JSON.stringify({ bookingId: 'booking-2', occurredAt: '2026-07-26T11:00:00.000Z' }),
      'booking.created',
      '20',
      (envelope) => analytics.applyDomainEvent(envelope),
    );

    expect(result).toBe('applied');
    expect(analytics.applyDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'booking.created',
        aggregateId: 'booking-2',
      }),
    );
  });

  it('audit consumer persists normalized envelope with kafka coordinates', async () => {
    const domainEvents = {
      persistFromKafka: jest.fn().mockResolvedValue('created'),
    } as unknown as DomainEventsService;

    await processKafkaConsumerMessage(
      JSON.stringify({
        eventId: 'evt-3',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'booking-3',
        occurredAt: '2026-07-26T12:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-3' },
      }),
      'booking.paid',
      '30',
      async (envelope) =>
        domainEvents.persistFromKafka({
          envelope,
          kafkaTopic: 'booking.paid',
          kafkaPartition: 1,
          kafkaOffset: '30',
        }),
    );

    expect(domainEvents.persistFromKafka).toHaveBeenCalledWith({
      envelope: expect.objectContaining({ aggregateId: 'booking-3' }),
      kafkaTopic: 'booking.paid',
      kafkaPartition: 1,
      kafkaOffset: '30',
    });
  });

  it('returns null for invalid kafka json without calling handlers', async () => {
    const notifications = {
      handleDomainEvent: jest.fn(),
    } as unknown as BookingNotificationsService;

    const result = await processKafkaConsumerMessage(
      '{bad-json',
      'ticket.issued',
      '1',
      (envelope) => notifications.handleDomainEvent(envelope),
    );

    expect(result).toBeNull();
    expect(notifications.handleDomainEvent).not.toHaveBeenCalled();
  });
});
