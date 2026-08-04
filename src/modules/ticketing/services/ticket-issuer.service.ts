import { Injectable } from '@nestjs/common';
import { Traveler } from '@prisma/client';
import type { FlightTraveler } from 'src/modules/flights/dtos/flight-pricing.response.dto';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import { GeneratedTicket } from '../types/ticket.types';
import { generateTicketNumber } from '../utils/ticket-number.util';
import { buildEticketDocumentData } from '../utils/eticket-document.util';
import { TicketDocumentService } from './ticket-document.service';
import { TicketPersistenceService } from './ticket-persistence.service';

type TravelerWithSeats = Traveler & {
  seatAssignments: Array<{
    segmentId: string;
    seat: {
      seatNumber: string;
    };
  }>;
};

export interface IssueTicketParams {
  bookingId: string;
  pnrLocator: string;
  traveler: TravelerWithSeats;
  snapshot: BookingSnapshot;
  travelerPricing?: FlightTraveler;
  /** Seat surcharge for this passenger in booking currency. */
  seatSurcharge?: number;
}

@Injectable()
export class TicketIssuerService {
  constructor(
    private readonly ticketDocument: TicketDocumentService,
    private readonly ticketPersistence: TicketPersistenceService,
  ) {}

  async prefetchTicketsByTravelerId(bookingId: string): Promise<Map<string, GeneratedTicket>> {
    const tickets = await this.ticketPersistence.findTicketsByBookingId(bookingId);

    return new Map(
      tickets.map((ticket) => [
        ticket.travelerId,
        {
          travelerId: ticket.travelerId,
          ticketNumber: ticket.ticketNumber,
          pdfKey: ticket.pdfKey,
        },
      ]),
    );
  }

  async issueForTraveler(
    params: IssueTicketParams,
    prefetchedTickets?: Map<string, GeneratedTicket>,
  ): Promise<GeneratedTicket> {
    const { bookingId, pnrLocator, traveler, snapshot, travelerPricing, seatSurcharge } = params;
    const existingTicket = prefetchedTickets?.get(traveler.id);

    const ticketNumber = existingTicket?.ticketNumber ?? generateTicketNumber();
    const issuedAt = new Date();
    const fileKey =
      existingTicket?.pdfKey ?? this.ticketDocument.buildTicketPdfKey(bookingId, traveler.id);

    const seatBySegmentId = new Map(
      traveler.seatAssignments.map((assignment) => [
        assignment.segmentId,
        assignment.seat.seatNumber,
      ]),
    );

    const documentData = buildEticketDocumentData({
      pnr: pnrLocator,
      ticketNumber,
      issuedAt,
      traveler,
      snapshot,
      travelerPricing,
      seatBySegmentId,
      seatSurcharge,
    });

    const pdfBuffer = await this.ticketDocument.generatePdf(documentData);

    if (!existingTicket) {
      await this.ticketPersistence.recordIssuedTicket({
        bookingId,
        travelerId: traveler.id,
        ticketNumber,
        pdfKey: fileKey,
        issuedAt,
      });
    }

    await this.ticketDocument.uploadPdf(fileKey, pdfBuffer);

    return {
      travelerId: traveler.id,
      ticketNumber,
      pdfKey: fileKey,
    };
  }
}
