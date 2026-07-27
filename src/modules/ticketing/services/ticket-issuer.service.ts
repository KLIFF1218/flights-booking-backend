import { Injectable } from '@nestjs/common';
import { EnumTransport, Traveler } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PdfService } from 'src/infra/pdf/pdf.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import type { FlightTraveler } from 'src/modules/flights/dtos/flight-pricing.response.dto';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import { GeneratedTicket } from '../types/ticket.types';
import { generateTicketNumber } from '../utils/ticket-number.util';
import { buildEticketDocumentData } from '../utils/eticket-document.util';

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
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly s3: S3Service,
    private readonly outbox: OutboxService,
  ) {}

  async issueForTraveler(params: IssueTicketParams): Promise<GeneratedTicket> {
    const { bookingId, pnrLocator, traveler, snapshot, travelerPricing, seatSurcharge } = params;

    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        bookingId,
        travelerId: traveler.id,
      },
    });

    if (existingTicket) {
      return {
        travelerId: traveler.id,
        ticketNumber: existingTicket.ticketNumber,
        pdfKey: existingTicket.pdfKey,
      };
    }

    const ticketNumber = generateTicketNumber();
    const issuedAt = new Date();
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

    const pdfBuffer = await this.pdfService.generateEticket(documentData);
    const fileKey = `tickets/${bookingId}/${traveler.id}.pdf`;

    await this.s3.uploadFile({
      key: fileKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          bookingId,
          travelerId: traveler.id,
          ticketNumber,
          pdfKey: fileKey,
        },
      });

      const eventPayload = {
        ticketId: created.id,
        bookingId,
        travelerId: traveler.id,
        ticketNumber: created.ticketNumber,
        issuedAt: issuedAt.toISOString(),
      };

      await this.outbox.enqueue(tx, {
        aggregateId: created.id,
        aggregateType: 'Ticket',
        topic: 'ticket.issued',
        payload: eventPayload,
        transport: EnumTransport.KAFKA,
      });

      return created;
    });

    return {
      travelerId: traveler.id,
      ticketNumber: ticket.ticketNumber,
      pdfKey: fileKey,
    };
  }
}
