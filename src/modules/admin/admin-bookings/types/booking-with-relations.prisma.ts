import type { Prisma } from '@prisma/client';

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    user: true;
    transaction: true;
    travelers: true;
    flightInstance: {
      include: {
        flight: {
          include: {
            segments: {
              include: {
                departureAirport: true;
                arrivalAirport: true;
              };
            };
            airline: true;
          };
        };
      };
    };
  };
}>;
