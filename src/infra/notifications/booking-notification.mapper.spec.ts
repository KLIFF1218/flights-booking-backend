import { UserNotificationType } from '@prisma/client';
import {
  isNotificationEventType,
  mapDomainEventToNotification,
} from './booking-notification.mapper';

describe('mapDomainEventToNotification', () => {
  it('does not treat booking.created as an in-app notification event', () => {
    expect(isNotificationEventType('booking.created')).toBe(false);
    expect(
      mapDomainEventToNotification({
        eventId: 'evt-created',
        eventType: 'booking.created',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-1', userId: 'user-1', pnr: 'ABC123' },
      }),
    ).toBeNull();
  });

  it('does not treat booking.paid as an in-app notification event', () => {
    expect(isNotificationEventType('booking.paid')).toBe(false);
    expect(
      mapDomainEventToNotification({
        eventId: 'evt-paid',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-1', userId: 'user-1' },
      }),
    ).toBeNull();
  });

  it('maps ticket.issued with ticket number', () => {
    const draft = mapDomainEventToNotification({
      eventId: 'evt-2',
      eventType: 'ticket.issued',
      aggregateType: 'Ticket',
      aggregateId: 'ticket-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: {
        bookingId: 'booking-1',
        ticketNumber: '123-456',
      },
    });

    expect(draft?.type).toBe(UserNotificationType.TICKET_ISSUED);
    expect(draft?.message).toContain('123-456');
  });

  it('maps flight.delayed admin event', () => {
    const draft = mapDomainEventToNotification({
      eventId: 'evt-3',
      eventType: 'flight.delayed',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: {
        bookingId: 'booking-1',
        userId: 'user-1',
        delayMinutes: 45,
        newDeparture: '2026-07-26T14:30:00.000Z',
      },
    });

    expect(draft?.type).toBe(UserNotificationType.FLIGHT_DELAYED);
    expect(draft?.message).toContain('45 min');
  });

  it('maps booking.ticketing.failed', () => {
    const draft = mapDomainEventToNotification({
      eventId: 'evt-4',
      eventType: 'booking.ticketing.failed',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', reason: 'S3_UPLOAD_FAILED' },
    });

    expect(draft?.type).toBe(UserNotificationType.TICKETING_FAILED);
    expect(draft?.message).toContain('S3 UPLOAD FAILED');
  });

  it('maps booking.expired', () => {
    const draft = mapDomainEventToNotification({
      eventId: 'evt-5',
      eventType: 'booking.expired',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1' },
    });

    expect(draft?.type).toBe(UserNotificationType.BOOKING_EXPIRED);
  });
});
