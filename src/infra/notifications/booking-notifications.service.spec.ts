import { UserNotificationType } from '@prisma/client';
import { BookingNotificationsService } from './booking-notifications.service';

describe('BookingNotificationsService', () => {
  const prisma = {
    booking: {
      findUnique: jest.fn(),
    },
  };

  const userNotifications = {
    createFromEvent: jest.fn(),
  };

  const logger = {
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const service = new BookingNotificationsService(
    prisma as never,
    userNotifications as never,
    logger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips booking.created (no in-app notification)', async () => {
    const result = await service.handleDomainEvent({
      eventId: 'evt-created',
      eventType: 'booking.created',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', userId: 'user-1' },
    });

    expect(result).toBe('skipped');
    expect(userNotifications.createFromEvent).not.toHaveBeenCalled();
  });

  it('skips booking.paid (ticket.issued is the success notification)', async () => {
    const result = await service.handleDomainEvent({
      eventId: 'evt-paid',
      eventType: 'booking.paid',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', userId: 'user-1' },
    });

    expect(result).toBe('skipped');
    expect(userNotifications.createFromEvent).not.toHaveBeenCalled();
  });

  it('creates in-app notification for ticket.issued', async () => {
    prisma.booking.findUnique.mockResolvedValue({ userId: 'user-1' });
    userNotifications.createFromEvent.mockResolvedValue({ id: 'notif-1' });

    const result = await service.handleDomainEvent({
      eventId: 'evt-ticket',
      eventType: 'ticket.issued',
      aggregateType: 'Ticket',
      aggregateId: 'ticket-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', ticketNumber: '555-123' },
    });

    expect(result).toBe('created');
    expect(userNotifications.createFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: 'evt-ticket',
        userId: 'user-1',
        bookingId: 'booking-1',
        type: UserNotificationType.TICKET_ISSUED,
      }),
    );
  });

  it('treats duplicate sourceEventId as duplicate', async () => {
    prisma.booking.findUnique.mockResolvedValue({ userId: 'user-1' });
    userNotifications.createFromEvent.mockResolvedValue(null);

    const result = await service.handleDomainEvent({
      eventId: 'evt-1',
      eventType: 'ticket.issued',
      aggregateType: 'Ticket',
      aggregateId: 'ticket-1',
      occurredAt: '2026-07-26T10:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', userId: 'user-1' },
    });

    expect(result).toBe('duplicate');
  });
});
