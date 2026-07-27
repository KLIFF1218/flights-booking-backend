import type { Prisma } from '@prisma/client';

export type TransactionWithBooking = Prisma.TransactionGetPayload<{
  include: {
    booking: {
      include: {
        user: true;
        travelers: true;
        tickets: true;
        seatAssignments: {
          include: {
            seat: true;
          };
        };
      };
    };
  };
}>;

export interface TicketWithUrls {
  id: string;
  travelerId: string;
  ticketNumber: string;
  status: string;
  previewUrl: string | null;
  downloadUrl: string | null;
}
