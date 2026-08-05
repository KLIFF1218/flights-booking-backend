import type { Currency } from '@prisma/client';

export type SortType = 'CHEAPEST' | 'FASTEST' | 'BEST' | 'DEPARTURE' | 'ARRIVAL';

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

/** Minimal offer shape required for flight-search cursor encoding/decoding. */
export type CursorPreprocessedOffer = {
  id: string;
  price: {
    total: string;
    currency: Currency;
  };
  preprocessed: {
    totalDurationMinutes: number;
    departureTimestamp: number;
    arrivalTimestamp: number;
    totalStops: number;
    bestScore?: number;
  };
};
