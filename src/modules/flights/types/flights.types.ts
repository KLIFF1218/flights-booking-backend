import type { Prisma } from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import type { SortType, FlightSearchCursorPayload } from 'src/shared/flights/search-cursor.types';

export type { SortType, FlightSearchCursorPayload } from 'src/shared/flights/search-cursor.types';

export type PreprocessedFlightOffer = FlightOffer & {
  preprocessed: {
    totalDurationMinutes: number;
    departureTimestamp: number;
    arrivalTimestamp: number;
    totalStops: number;
    bestScore?: number;
  };
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
