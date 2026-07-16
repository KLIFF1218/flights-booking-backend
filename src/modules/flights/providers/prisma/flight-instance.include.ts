import { Prisma } from '@prisma/client';

export const flightInstanceInclude = Prisma.validator<Prisma.FlightInstanceInclude>()({
  flight: {
    include: {
      departureAirport: true,
      arrivalAirport: true,
      airline: true,
      segments: {
        orderBy: { segmentOrder: 'asc' },
        include: {
          departureAirport: true,
          arrivalAirport: true,
          aircraft: true,
        },
      },
    },
  },
  fares: true,
});
