import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { MailService } from 'src/infra/mail/mail.service';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { isTicketingUnrecoverableError, TicketingErrorCode } from '../errors/ticketing.errors';
import { escalateTicketingFailure } from '../utils/ticketing-failure-escalation.util';

@Injectable()
export class TicketingFailureHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly mailService: MailService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly logger: Logger,
  ) {}

  async handleJobFailure(error: unknown, bookingId: string): Promise<void> {
    if (isTicketingUnrecoverableError(error) && error.bookingId) {
      await this.escalateAndNotify(error.bookingId, error.code);
      return;
    }

    this.logger.error(
      {
        err: error instanceof Error ? error : String(error),
        bookingId,
        ticketingErrorCode: isTicketingUnrecoverableError(error) ? error.code : undefined,
        unrecoverable: isTicketingUnrecoverableError(error),
      },
      'Ticketing job failed',
    );
  }

  async handleExhaustedRetries(bookingId: string, error: unknown): Promise<void> {
    if (isTicketingUnrecoverableError(error)) {
      return;
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, userId: true },
    });

    if (!booking || booking.status === 'FAILED' || booking.status === 'TICKETED') {
      return;
    }

    this.logger.error(
      { bookingId, err: error instanceof Error ? error : String(error) },
      'Ticketing job exhausted retries; escalating to compensation workflow',
    );

    await this.escalateAndNotify(bookingId, TicketingErrorCode.RETRIES_EXHAUSTED, booking.userId);
  }

  private async escalateAndNotify(
    bookingId: string,
    reason: TicketingErrorCode,
    fallbackUserId?: string,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        userId: true,
        user: { select: { email: true } },
      },
    });

    await escalateTicketingFailure(
      {
        prisma: this.prisma,
        outbox: this.outbox,
        logger: this.logger,
        bookingMetrics: this.bookingMetrics,
      },
      bookingId,
      reason,
      booking?.userId ?? fallbackUserId ?? 'unknown',
    );

    if (booking?.user?.email) {
      try {
        await this.mailService.sendBookingFailed({ email: booking.user.email }, bookingId);
      } catch (mailError: unknown) {
        this.logger.error(
          {
            err: mailError instanceof Error ? mailError : String(mailError),
            bookingId,
          },
          'Failed to enqueue booking-failed email after ticketing failure',
        );
      }
    }
  }
}
