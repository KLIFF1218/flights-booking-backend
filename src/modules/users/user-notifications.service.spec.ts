import { NotFoundException } from '@nestjs/common';
import { UserNotificationType } from '@prisma/client';
import { UserNotificationsService } from './user-notifications.service';

describe('UserNotificationsService', () => {
  const prisma = {
    userNotification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };

  const notificationRealtime = {
    publishCreated: jest.fn().mockResolvedValue(undefined),
  };

  const service = new UserNotificationsService(prisma as never, notificationRealtime as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    // Most tests create a notification for a booking the caller owns; the
    // ownership-violation case below overrides this explicitly.
    prisma.booking.findUnique.mockResolvedValue({ userId: 'user-1' });
  });

  it('runs the duplicate check and write inside a single (serializable) transaction', async () => {
    prisma.userNotification.findFirst.mockResolvedValue(null);
    prisma.userNotification.create.mockResolvedValue({ id: 'new-id' });

    await service.create({
      userId: 'user-1',
      bookingId: 'booking-1',
      type: UserNotificationType.FLIGHT_DELAYED,
      title: 'Flight delay',
      message: 'Flight delayed by 15 min.',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: expect.any(String) }),
    );
  });

  it('updates unread duplicate instead of creating a new notification', async () => {
    prisma.userNotification.findFirst.mockResolvedValue({
      id: 'existing-id',
    });
    prisma.userNotification.update.mockResolvedValue({
      id: 'existing-id',
      message: 'updated',
    });

    const result = await service.create({
      userId: 'user-1',
      bookingId: 'booking-1',
      type: UserNotificationType.FLIGHT_DELAYED,
      title: 'Flight delay',
      message: 'Flight delayed by 30 min.',
    });

    expect(prisma.userNotification.create).not.toHaveBeenCalled();
    expect(prisma.userNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-id' },
        data: expect.objectContaining({
          title: 'Flight delay',
          message: 'Flight delayed by 30 min.',
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'existing-id', message: 'updated' }));
  });

  it('creates a new notification when no unread duplicate exists', async () => {
    prisma.userNotification.findFirst.mockResolvedValue(null);
    prisma.userNotification.create.mockResolvedValue({ id: 'new-id' });

    await service.create({
      userId: 'user-1',
      bookingId: 'booking-1',
      type: UserNotificationType.FLIGHT_DELAYED,
      title: 'Flight delay',
      message: 'Flight delayed by 15 min.',
    });

    expect(prisma.userNotification.create).toHaveBeenCalled();
    expect(prisma.userNotification.update).not.toHaveBeenCalled();
    expect(notificationRealtime.publishCreated).toHaveBeenCalledWith('user-1', {
      notificationId: 'new-id',
      notificationType: UserNotificationType.FLIGHT_DELAYED,
    });
  });

  it('retries once when the serializable transaction reports a conflict (P2034)', async () => {
    const { Prisma } = jest.requireActual('@prisma/client');
    const conflictError = new Prisma.PrismaClientKnownRequestError('transaction conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });

    prisma.$transaction
      .mockRejectedValueOnce(conflictError)
      .mockImplementationOnce((fn: (tx: unknown) => unknown) => fn(prisma));

    prisma.userNotification.findFirst.mockResolvedValue(null);
    prisma.userNotification.create.mockResolvedValue({ id: 'new-id' });

    await service.create({
      userId: 'user-1',
      bookingId: 'booking-1',
      type: UserNotificationType.FLIGHT_DELAYED,
      title: 'Flight delay',
      message: 'Flight delayed by 15 min.',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.userNotification.create).toHaveBeenCalled();
  });

  it('rejects creating a notification for a booking owned by another user', async () => {
    prisma.booking.findUnique.mockResolvedValue({ userId: 'someone-else' });

    await expect(
      service.create({
        userId: 'user-1',
        bookingId: 'booking-1',
        type: UserNotificationType.FLIGHT_DELAYED,
        title: 'Flight delay',
        message: 'Flight delayed by 15 min.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.userNotification.findFirst).not.toHaveBeenCalled();
    expect(prisma.userNotification.create).not.toHaveBeenCalled();
  });

  it('rejects creating a notification for a booking that does not exist', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        userId: 'user-1',
        bookingId: 'missing-booking',
        type: UserNotificationType.FLIGHT_DELAYED,
        title: 'Flight delay',
        message: 'Flight delayed by 15 min.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('createFromEvent', () => {
    const eventInput = {
      userId: 'user-1',
      bookingId: 'booking-1',
      type: UserNotificationType.FLIGHT_DELAYED,
      title: 'Flight delay',
      message: 'Flight delayed by 15 min.',
      sourceEventId: 'evt-1',
    };

    it('creates notification from event and publishes realtime update', async () => {
      prisma.userNotification.create.mockResolvedValue({
        id: 'event-notif-1',
        bookingId: 'booking-1',
        type: UserNotificationType.FLIGHT_DELAYED,
        title: 'Flight delay',
        message: 'Flight delayed by 15 min.',
        readAt: null,
        createdAt: new Date(),
      });

      const result = await service.createFromEvent(eventInput);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'event-notif-1',
          bookingId: 'booking-1',
        }),
      );
      expect(notificationRealtime.publishCreated).toHaveBeenCalledWith('user-1', {
        notificationId: 'event-notif-1',
        notificationType: UserNotificationType.FLIGHT_DELAYED,
      });
    });

    it('returns null when sourceEventId already exists', async () => {
      const { Prisma } = jest.requireActual('@prisma/client');
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['sourceEventId'] },
        }),
      );

      await expect(service.createFromEvent(eventInput)).resolves.toBeNull();
      expect(notificationRealtime.publishCreated).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('returns notifications ordered by createdAt desc with default limit', async () => {
      prisma.userNotification.findMany.mockResolvedValue([
        {
          id: 'n-1',
          bookingId: null,
          type: UserNotificationType.FLIGHT_DELAYED,
          title: 'Delay',
          message: 'Delayed',
          readAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listForUser('user-1');

      expect(prisma.userNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          take: 20,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters unread notifications when unreadOnly is true', async () => {
      prisma.userNotification.findMany.mockResolvedValue([]);

      await service.listForUser('user-1', { unreadOnly: true, limit: 5 });

      expect(prisma.userNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', readAt: null },
          take: 5,
        }),
      );
    });
  });

  describe('countUnread', () => {
    it('returns unread notification count', async () => {
      prisma.userNotification.count.mockResolvedValue(7);

      await expect(service.countUnread('user-1')).resolves.toBe(7);
      expect(prisma.userNotification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
    });
  });

  describe('markRead', () => {
    it('returns existing notification when already read', async () => {
      const readNotification = {
        id: 'n-1',
        bookingId: null,
        type: UserNotificationType.FLIGHT_DELAYED,
        title: 'Delay',
        message: 'Delayed',
        readAt: new Date(),
        createdAt: new Date(),
      };

      prisma.userNotification.findFirst.mockResolvedValue(readNotification);

      const result = await service.markRead('user-1', 'n-1');

      expect(prisma.userNotification.update).not.toHaveBeenCalled();
      expect(result.id).toBe('n-1');
    });

    it('marks unread notification as read', async () => {
      const unreadNotification = {
        id: 'n-2',
        bookingId: null,
        type: UserNotificationType.FLIGHT_CANCELLED,
        title: 'Cancelled',
        message: 'Cancelled',
        readAt: null,
        createdAt: new Date(),
      };
      const readAt = new Date('2026-07-01T10:00:00Z');

      prisma.userNotification.findFirst.mockResolvedValue(unreadNotification);
      prisma.userNotification.update.mockResolvedValue({
        ...unreadNotification,
        readAt,
      });

      const result = await service.markRead('user-1', 'n-2');

      expect(prisma.userNotification.update).toHaveBeenCalledWith({
        where: { id: 'n-2' },
        data: { readAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(result.readAt).toEqual(readAt);
    });

    it('throws NotFoundException for another user notification', async () => {
      prisma.userNotification.findFirst.mockResolvedValue(null);

      await expect(service.markRead('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('returns the number of updated notifications', async () => {
      prisma.userNotification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllRead('user-1');

      expect(result).toEqual({ updated: 4 });
    });
  });
});
