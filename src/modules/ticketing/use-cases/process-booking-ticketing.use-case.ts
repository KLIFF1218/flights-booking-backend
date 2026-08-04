import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MailService } from 'src/infra/mail/mail.service';
import { BookingsCacheService } from 'src/modules/bookings/services/bookings-cache.service';
import { Logger } from 'nestjs-pino';
import { TicketIssuerService } from '../services/ticket-issuer.service';
import type { GeneratedTicket } from '../types/ticket.types';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import {
  createTravelerPricingResolver,
  sortTravelersForPricingMatch,
} from 'src/modules/bookings/utils/resolve-traveler-pricing.util';
import { allocateSeatSurcharge } from '../utils/eticket-document.util';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import { TicketingErrorCode, TicketingUnrecoverableError } from '../errors/ticketing.errors';
import {
  isEligibleForTicketing,
  TICKETING_MARK_TICKETED_STATUSES,
} from '../domain/ticketing-booking.policy';

@Injectable()
export class ProcessBookingTicketingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketIssuer: TicketIssuerService,
    private readonly mailService: MailService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly logger: Logger,
  ) {}

  async execute(bookingId: string): Promise<void> {
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
      return;
    }

    if (!isEligibleForTicketing(booking.status)) {
      this.logger.warn(
        { bookingId, status: booking.status },
        'Booking is not eligible for ticketing, skipping',
      );
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
      await this.prisma.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.PAID },
        data: { status: BookingStatus.TICKETING },
      });
    }

    const prefetchedTickets = await this.ticketIssuer.prefetchTicketsByTravelerId(bookingId);
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

      const ticket = await this.ticketIssuer.issueForTraveler(
        {
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
        },
        prefetchedTickets,
      );

      generatedTickets.push(ticket);
    }

    const issuedTicketCount = await this.prisma.ticket.count({
      where: { bookingId },
    });

    if (issuedTicketCount < booking.travelers.length) {
      throw new TicketingUnrecoverableError(
        'Not all tickets were issued',
        TicketingErrorCode.INCOMPLETE_ISSUANCE,
        bookingId,
      );
    }

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

    const markedTicketed = await this.prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: { in: TICKETING_MARK_TICKETED_STATUSES },
      },
      data: { status: BookingStatus.TICKETED },
    });

    if (markedTicketed.count === 0) {
      const current = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });

      if (current?.status !== BookingStatus.TICKETED) {
        throw new TicketingUnrecoverableError(
          'Booking could not be marked as ticketed',
          TicketingErrorCode.INCOMPLETE_ISSUANCE,
          bookingId,
        );
      }
    }

    logBookingFlowStage(this.logger, BookingFlowStage.TICKET_ISSUED, {
      bookingId,
      ticketCount: generatedTickets.length,
      ticketNumbers: generatedTickets.map((ticket) => ticket.ticketNumber),
    });

    await this.bookingsCache.invalidateBooking(bookingId, booking.userId);
  }
}
