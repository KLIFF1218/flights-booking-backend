import type { Prisma } from '@prisma/client';
import type { flightInstanceInclude } from './flight-instance.include';

export type FlightInstanceWithRelations = Prisma.FlightInstanceGetPayload<{
  include: typeof flightInstanceInclude;
}>;
