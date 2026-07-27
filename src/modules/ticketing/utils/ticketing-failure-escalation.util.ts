import { BookingStatus, EnumTransport } from '@prisma/client';
import { type Logger } from 'nestjs-pino';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type OutboxService } from 'src/infra/outbox/outbox.service';
import { BOOKING_TICKETING_FAILED_OUTBOX_TOPIC } from 'src/modules/bookings/constants/booking-outbox.constants';
import { type BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { type TicketingErrorCode } from 'src/modules/ticketing/errors/ticketing.errors';

const FAILABLE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];

export async function escalateTicketingFailure(
  deps: {
    prisma: PrismaService;
    outbox: OutboxService;
    logger: Logger;
    bookingMetrics: BookingMetricsService;
  },
  bookingId: string,
  reason: TicketingErrorCode,
  userId: string,
): Promise<void> {
  try {
    await deps.prisma.$transaction(async (tx) => {
      await deps.outbox.enqueue(tx, {
        aggregateId: bookingId,
        aggregateType: 'Booking',
        topic: BOOKING_TICKETING_FAILED_OUTBOX_TOPIC,
        key: `${bookingId}:ticketing-failed`,
        payload: {
          bookingId,
          reason,
          userId,
        },
        transport: EnumTransport.INTERNAL,
      });

      await deps.outbox.enqueue(tx, {
        aggregateId: bookingId,
        aggregateType: 'Booking',
        topic: 'booking.ticketing.failed',
        payload: {
          bookingId,
          userId,
          reason,
          occurredAt: new Date().toISOString(),
        },
        transport: EnumTransport.KAFKA,
      });

      const updated = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: { in: FAILABLE_STATUSES },
        },
        data: { status: BookingStatus.FAILED },
      });

      if (updated.count === 0) {
        throw new Error('Booking is no longer eligible for ticketing failure escalation');
      }
    });

    deps.bookingMetrics.recordOutboxEnqueued(
      BOOKING_TICKETING_FAILED_OUTBOX_TOPIC,
      EnumTransport.INTERNAL,
    );
    deps.logger.error(
      { bookingId, reason },
      'Ticketing failure escalated via outbox compensation workflow',
    );
  } catch (error) {
    deps.bookingMetrics.recordTicketingFailureEscalationFailed(reason);
    deps.logger.error(
      {
        bookingId,
        reason,
        err: error instanceof Error ? error : String(error),
      },
      'DEAD LETTER: failed to escalate ticketing failure',
    );
  }
}
