import type { Prisma } from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';

export type SortType = 'CHEAPEST' | 'FASTEST' | 'BEST' | 'DEPARTURE' | 'ARRIVAL';

export type PreprocessedFlightOffer = FlightOffer & {
  preprocessed: {
    totalDurationMinutes: number;
    departureTimestamp: number;
    arrivalTimestamp: number;
    totalStops: number;
    bestScore?: number;
  };
};

export type FlightSearchCursorPayload = {
  sort: SortType;
  searchHash: string;

  price?: number;
  duration?: number;
  departure?: number;
  arrival?: number;
  score?: number;

  id: string;
};

export interface SortStrategy {
  getPrimaryValue(offer: PreprocessedFlightOffer): number | string;
  compare(a: PreprocessedFlightOffer, b: PreprocessedFlightOffer): number;
}

export type Fare = FlightInstanceWithRelations['fares'][number];

export type FlightInstanceWithFares = Prisma.FlightInstanceGetPayload<{
  include: {
    fares: true;
  };
}>;
