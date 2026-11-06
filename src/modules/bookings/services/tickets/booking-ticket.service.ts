import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from 'src/infra/storage/s3.service';
import { BookingWorkflowService } from '../booking/booking-workflow.service';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';
import { extractRouteFromSnapshot } from '../../utils/snapshot/booking-snapshot.util';
import { canAccessBookingTickets } from '../../utils/tickets/booking-ticket-access.util';
import { BookingMetricsService } from '../../metrics/booking-metrics.service';

const ticketsInclude = {
  tickets: true,
} satisfies Prisma.BookingInclude;

type BookingWithTickets = Prisma.BookingGetPayload<{
  include: typeof ticketsInclude;
}>;

@Injectable()
export class BookingTicketService {
  constructor(
    private readonly bookingWorkflow: BookingWorkflowService,
    private readonly s3: S3Service,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  async getTickets(bookingId: string, userId: string, mode: 'view' | 'download' = 'view') {
    const booking = (await this.bookingWorkflow.findBookingForUser(
      bookingId,
      userId,
      ticketsInclude,
    )) as BookingWithTickets;

    if (!canAccessBookingTickets(booking.status)) {
      this.bookingMetrics.recordTicketDownload('not_found');
      throw new NotFoundException('Tickets not found');
    }

    if (!booking.tickets.length) {
      this.bookingMetrics.recordTicketDownload('not_found');
      throw new NotFoundException('Tickets not found');
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    const { origin, destination } = extractRouteFromSnapshot(snapshot);

    const tickets = await Promise.all(
      booking.tickets.map(async (ticket) => {
        const exists = await this.s3.fileExists(ticket.pdfKey);

        if (!exists) {
          return null;
        }

        const fileName = `E-Ticket-${booking.pnrLocator}-${origin}-${destination}-${ticket.ticketNumber}.pdf`;

        const previewUrl = await this.s3.getDownloadUrl(ticket.pdfKey, {
          disposition: 'inline',
          fileName,
        });

        const downloadUrl = await this.s3.getDownloadUrl(ticket.pdfKey, {
          disposition: 'attachment',
          fileName,
        });

        return {
          travelerId: ticket.travelerId,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          previewUrl,
          downloadUrl,
          url: mode === 'download' ? downloadUrl : previewUrl,
        };
      }),
    );

    const availableTickets = tickets.filter(
      (ticket): ticket is NonNullable<typeof ticket> => ticket !== null,
    );

    if (!availableTickets.length) {
      this.bookingMetrics.recordTicketDownload('missing_pdf');
      throw new NotFoundException('Tickets not found');
    }

    this.bookingMetrics.recordTicketDownload('success');

    return availableTickets;
  }
}
