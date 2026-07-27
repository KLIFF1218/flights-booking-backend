import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MailService } from 'src/infra/mail/mail.service';
import { BookingStatus } from '@prisma/client';
import { BookingsCacheService } from '../bookings/services/bookings-cache.service';
import { Logger } from 'nestjs-pino';
import { TicketIssuerService } from './services/ticket-issuer.service';
import { GeneratedTicket } from './types/ticket.types';
import type { BookingSnapshot } from '../bookings/interfaces/booking-snapshot.interface';
import {
  createTravelerPricingResolver,
  sortTravelersForPricingMatch,
} from '../bookings/utils/resolve-traveler-pricing.util';
import { allocateSeatSurcharge } from './utils/eticket-document.util';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import {
  isTicketingUnrecoverableError,
  TicketingErrorCode,
  TicketingUnrecoverableError,
} from './errors/ticketing.errors';
import { TICKETING_QUEUE_NAME } from './ticketing-queue.config';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { BookingMetricsService } from '../bookings/metrics/booking-metrics.service';
import { escalateTicketingFailure } from './utils/ticketing-failure-escalation.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { normalizeTicketingFailureReason } from 'src/infra/metrics/normalize-metric-reason.util';

const ELIGIBLE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.TICKETING];

@Processor(TICKETING_QUEUE_NAME)
export class TicketingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketIssuer: TicketIssuerService,
    private readonly mailService: MailService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly outbox: OutboxService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;
    const startedAt = Date.now();

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          travelers: {
            orderBy: { createdAt: 'asc' },
            include: {
              seatAssignments: {
                include: {
                  seat: true,
                },
              },
            },
          },
          tickets: true,
        },
      });

      if (!booking) {
        throw new TicketingUnrecoverableError(
          'Booking not found',
          TicketingErrorCode.BOOKING_NOT_FOUND,
          bookingId,
        );
      }

      if (!booking.snapshot) {
        throw new TicketingUnrecoverableError(
          'Booking snapshot is missing',
          TicketingErrorCode.SNAPSHOT_MISSING,
          bookingId,
        );
      }

      if (booking.status === BookingStatus.TICKETED) {
        this.logger.log({ bookingId }, 'Booking already ticketed, skipping');
        runSafely(() => {
          this.metrics.recordTicketingCompleted();
          this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
        });
        return;
      }

      if (!ELIGIBLE_STATUSES.includes(booking.status)) {
        this.logger.warn(
          { bookingId, status: booking.status },
          'Booking is not eligible for ticketing, skipping',
        );
        runSafely(() => {
          this.metrics.recordTicketingCompleted();
          this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
        });
        return;
      }

      if (!booking.travelers.length) {
        throw new TicketingUnrecoverableError(
          'Booking has no travelers',
          TicketingErrorCode.NO_TRAVELERS,
          bookingId,
        );
      }

      const snapshot = booking.snapshot as unknown as BookingSnapshot;
      const pricingTravelers = snapshot.pricing?.travelers ?? [];
      const resolvePricing = createTravelerPricingResolver(pricingTravelers);
      const travelers = sortTravelersForPricingMatch(booking.travelers);
      const bookingSeatsTotal = Number(snapshot.pricing?.price?.seats ?? 0);
      const bookingSeatAssignmentTotal = travelers.reduce(
        (sum, traveler) => sum + traveler.seatAssignments.length,
        0,
      );

      if (booking.status === BookingStatus.PAID) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.TICKETING },
        });
      }

      const generatedTickets: GeneratedTicket[] = [];

      for (const traveler of travelers) {
        const travelerPricing = resolvePricing(traveler.passengerType);

        if (!travelerPricing) {
          throw new TicketingUnrecoverableError(
            `Pricing not found for traveler ${traveler.id} (${traveler.passengerType})`,
            TicketingErrorCode.PRICING_NOT_FOUND,
            bookingId,
          );
        }

        const ticket = await this.ticketIssuer.issueForTraveler({
          bookingId,
          pnrLocator: booking.pnrLocator,
          traveler,
          snapshot,
          travelerPricing,
          seatSurcharge: allocateSeatSurcharge({
            bookingSeatsTotal,
            travelerSeatCount: traveler.seatAssignments.length,
            bookingSeatAssignmentTotal,
          }),
        });

        generatedTickets.push(ticket);
      }

      const issuedTicketCount = await this.prisma.ticket.count({
        where: { bookingId },
      });

      if (issuedTicketCount < booking.travelers.length) {
        throw new Error('Not all tickets were issued');
      }

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.TICKETED },
      });

      logBookingFlowStage(this.logger, BookingFlowStage.TICKET_ISSUED, {
        bookingId,
        ticketCount: generatedTickets.length,
        ticketNumbers: generatedTickets.map((ticket) => ticket.ticketNumber),
      });

      await this.bookingsCache.invalidateBooking(bookingId, booking.userId);

      if (booking.user.email) {
        await this.mailService.sendBookingSuccess(
          {
            ...booking.user,
            email: booking.user.email,
          },
          bookingId,
          generatedTickets,
        );
      }

      runSafely(() => {
        this.metrics.recordTicketingCompleted();
        this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
      });
    } catch (error: unknown) {
      runSafely(() => {
        this.metrics.recordTicketingFailed(normalizeTicketingFailureReason(error));
        this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
      });

      if (isTicketingUnrecoverableError(error) && error.bookingId) {
        const booking = await this.prisma.booking.findUnique({
          where: { id: error.bookingId },
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
          error.bookingId,
          error.code,
          booking?.userId ?? 'unknown',
        );

        if (booking?.user?.email) {
          try {
            await this.mailService.sendBookingFailed(
              { email: booking.user.email },
              error.bookingId,
            );
          } catch (mailError: unknown) {
            this.logger.error(
              {
                err: mailError instanceof Error ? mailError : String(mailError),
                bookingId: error.bookingId,
              },
              'Failed to enqueue booking-failed email after ticketing failure',
            );
          }
        }
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
      throw error;
    }
  }
}
