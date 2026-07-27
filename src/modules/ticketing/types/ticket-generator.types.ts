import type { Traveler } from '@prisma/client';
import type { Segment } from 'src/modules/flights/interfaces/flight-offers.interface';

export interface GenerateTicketParams {
  bookingId: string;
  pnr: string;
  traveler: Traveler;
  firstSegment: Segment;
}

export interface GeneratedTicketResult {
  ticketId: string;
  travelerId: string;
  ticketNumber: string;
  pdfKey: string;
}
