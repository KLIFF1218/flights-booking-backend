import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { DomainEventEnvelope } from 'src/infra/kafka/domain-event-envelope.util';
import { UserNotificationsService } from 'src/modules/users/user-notifications.service';
import {
  isNotificationEventType,
  mapDomainEventToNotification,
} from './booking-notification.mapper';

@Injectable()
export class BookingNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userNotifications: UserNotificationsService,
    private readonly logger: Logger,
  ) {}

  async handleDomainEvent(envelope: DomainEventEnvelope): Promise<'created' | 'skipped' | 'duplicate'> {
    if (!isNotificationEventType(envelope.eventType)) {
      return 'skipped';
    }

    const draft = mapDomainEventToNotification(envelope);
    if (!draft) {
      this.logger.warn(
        { eventId: envelope.eventId, eventType: envelope.eventType },
        'Skipping notification: insufficient event payload',
      );
      return 'skipped';
    }

    if (draft.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: draft.bookingId },
        select: { userId: true },
      });

      if (!booking) {
        this.logger.warn(
          { eventId: envelope.eventId, bookingId: draft.bookingId },
          'Skipping notification: booking not found',
        );
        return 'skipped';
      }

      draft.userId = booking.userId;
    }

    if (!draft.userId) {
      return 'skipped';
    }

    const result = await this.userNotifications.createFromEvent({
      sourceEventId: envelope.eventId,
      userId: draft.userId,
      bookingId: draft.bookingId,
      type: draft.type,
      title: draft.title,
      message: draft.message,
    });

    if (result === null) {
      return 'duplicate';
    }

    this.logger.debug(
      {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        userId: draft.userId,
        bookingId: draft.bookingId,
        notificationId: result.id,
      },
      'In-app notification created from domain event',
    );

    return 'created';
  }
}
