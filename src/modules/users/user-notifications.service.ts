import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserNotificationType } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { runSerializableTransaction } from 'src/common/utils/run-serializable-transaction.util';
import { UserNotificationResponseDto } from './dtos/user-notification-response.dto';
import { NotificationRealtimeService } from 'src/infra/notifications/notification-realtime.service';

export type CreateUserNotificationInput = {
  userId: string;
  bookingId?: string;
  type: UserNotificationType;
  title: string;
  message: string;
};

export type CreateUserNotificationFromEventInput = CreateUserNotificationInput & {
  sourceEventId: string;
};

const notificationSelect = {
  id: true,
  bookingId: true,
  type: true,
  title: true,
  message: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UserNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRealtime: NotificationRealtimeService,
  ) {}

  async create(input: CreateUserNotificationInput): Promise<UserNotificationResponseDto> {
    const notification = await runSerializableTransaction(this.prisma, (tx) =>
      this.upsertUnread(tx, input),
    );

    const response = this.toResponse(notification);
    void this.notificationRealtime.publishCreated(input.userId, {
      notificationId: response.id,
      notificationType: input.type,
    });

    return response;
  }

  /**
   * Idempotent create for Kafka-driven notifications. Duplicate `sourceEventId`
   * values are ignored so consumer retries do not create duplicate in-app alerts.
   */
  async createFromEvent(
    input: CreateUserNotificationFromEventInput,
  ): Promise<UserNotificationResponseDto | null> {
    try {
      const notification = await runSerializableTransaction(this.prisma, async (tx) => {
        if (input.bookingId) {
          await this.assertBookingOwnership(tx, input.userId, input.bookingId);
        }

        return tx.userNotification.create({
          data: {
            userId: input.userId,
            bookingId: input.bookingId,
            type: input.type,
            title: input.title,
            message: input.message,
            sourceEventId: input.sourceEventId,
          },
          select: notificationSelect,
        });
      });

      const response = this.toResponse(notification);
      void this.notificationRealtime.publishCreated(input.userId, {
        notificationId: response.id,
        notificationType: input.type,
      });

      return response;
    } catch (error) {
      if (this.isSourceEventIdConflict(error)) {
        return null;
      }

      throw error;
    }
  }

  async listForUser(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<UserNotificationResponseDto[]> {
    const limit = options.limit ?? 20;

    const notifications = await this.prisma.userNotification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: notificationSelect,
    });

    return notifications.map((notification) => this.toResponse(notification));
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<UserNotificationResponseDto> {
    const notification = await this.prisma.userNotification.findFirst({
      where: { id: notificationId, userId },
      select: notificationSelect,
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.readAt) {
      return this.toResponse(notification);
    }

    const updated = await this.prisma.userNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      select: notificationSelect,
    });

    return this.toResponse(updated);
  }

  private isSourceEventIdConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('sourceEventId')
    );
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  /**
   * Finds-or-updates the unread duplicate and creates otherwise, all inside a
   * single transaction so concurrent callers (e.g. repeated flight-delay
   * events) can't both pass the "no unread duplicate" check and create two
   * notifications for the same booking/type.
   */
  private async upsertUnread(tx: Prisma.TransactionClient, input: CreateUserNotificationInput) {
    if (input.bookingId) {
      await this.assertBookingOwnership(tx, input.userId, input.bookingId);

      const existingUnread = await tx.userNotification.findFirst({
        where: {
          userId: input.userId,
          bookingId: input.bookingId,
          type: input.type,
          readAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: notificationSelect,
      });

      if (existingUnread) {
        return tx.userNotification.update({
          where: { id: existingUnread.id },
          data: {
            title: input.title,
            message: input.message,
            createdAt: new Date(),
          },
          select: notificationSelect,
        });
      }
    }

    return tx.userNotification.create({
      data: input,
      select: notificationSelect,
    });
  }

  /**
   * A notification tied to a booking must belong to the same user the
   * booking belongs to. Without this check, any caller that can invoke
   * `create` with an arbitrary `bookingId` could attach a notification (and
   * the booking context it carries) to a user who doesn't own that booking.
   */
  private async assertBookingOwnership(
    tx: Prisma.TransactionClient,
    userId: string,
    bookingId: string,
  ): Promise<void> {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });

    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found for this user');
    }
  }

  private toResponse(notification: {
    id: string;
    bookingId: string | null;
    type: UserNotificationType;
    title: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }): UserNotificationResponseDto {
    return {
      id: notification.id,
      bookingId: notification.bookingId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
