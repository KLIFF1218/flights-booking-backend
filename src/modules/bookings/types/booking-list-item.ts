import type { Prisma } from '@prisma/client';

export const bookingListItemSelect = {
  id: true,
  pnrLocator: true,
  status: true,
  totalPrice: true,
  currency: true,
  flightOrderId: true,
  createdAt: true,
  lastTicketingDate: true,
  provider: true,
  snapshot: true,
  travelers: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  transaction: {
    select: {
      id: true,
    },
  },
  seatAssignments: {
    select: {
      travelerId: true,
      seat: {
        select: {
          seatNumber: true,
        },
      },
    },
  },
  tickets: {
    select: {
      id: true,
      travelerId: true,
      ticketNumber: true,
      status: true,
    },
  },
  flightInstance: {
    select: {
      status: true,
      delayMinutes: true,
      departureDate: true,
      originalDepartureDate: true,
    },
  },
} satisfies Prisma.BookingSelect;

export type BookingListItemEntity = Prisma.BookingGetPayload<{
  select: typeof bookingListItemSelect;
}>;
