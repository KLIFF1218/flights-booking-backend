import type { Prisma } from '@prisma/client';

export type FlightInstanceWithRelations = Prisma.FlightInstanceGetPayload<{
  include: {
    fares: true;

    flight: {
      include: {
        airline: true;

        segments: {
          include: {
            departureAirport: true;
            arrivalAirport: true;
            aircraft: true;
          };
        };
      };
    };
  };
}>;

export type FlightSegmentWithRelations = FlightInstanceWithRelations['flight']['segments'][number];
