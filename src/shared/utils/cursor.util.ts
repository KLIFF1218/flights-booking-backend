import { BadRequestException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import type {
  CursorPreprocessedOffer,
  FlightSearchCursorPayload,
  SortType,
} from '../flights/search-cursor.types';

export function buildCursor(
  offer: CursorPreprocessedOffer,
  sort: SortType,
  searchHash: string,
): FlightSearchCursorPayload {
  switch (sort) {
    case 'CHEAPEST':
      return {
        sort,
        searchHash,
        price: Number(offer.price.total),
        duration: offer.preprocessed.totalDurationMinutes,
        departure: offer.preprocessed.departureTimestamp,
        id: offer.id,
      };

    case 'FASTEST':
      return {
        sort,
        searchHash,
        duration: offer.preprocessed.totalDurationMinutes,
        price: Number(offer.price.total),
        departure: offer.preprocessed.departureTimestamp,
        id: offer.id,
      };

    case 'BEST':
      return {
        sort,
        searchHash,
        score: offer.preprocessed.bestScore ?? 0,
        departure: offer.preprocessed.departureTimestamp,
        price: Number(offer.price.total),
        duration: offer.preprocessed.totalDurationMinutes,
        id: offer.id,
      };
    case 'DEPARTURE':
      return {
        sort,
        searchHash,
        departure: offer.preprocessed.departureTimestamp,
        price: Number(offer.price.total),
        duration: offer.preprocessed.totalDurationMinutes,
        id: offer.id,
      };

    case 'ARRIVAL':
      return {
        sort,
        searchHash,
        arrival: offer.preprocessed.arrivalTimestamp,
        price: Number(offer.price.total),
        duration: offer.preprocessed.totalDurationMinutes,
        id: offer.id,
      };
  }
}

export function encodeCursor<T extends object>(payload: T): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor<T>(cursor?: string): T | null {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString()) as T;
  } catch {
    throw new BadRequestException('Malformed cursor token');
  }
}

export function cursorToFakeOffer(
  cursor: FlightSearchCursorPayload,
): Partial<CursorPreprocessedOffer> {
  return {
    id: cursor.id,
    price: {
      total: String(cursor.price ?? 0),
      currency: Currency.USD,
    },
    preprocessed: {
      totalDurationMinutes: cursor.duration ?? 0,
      departureTimestamp: cursor.departure ?? 0,
      arrivalTimestamp: cursor.arrival ?? 0,
      bestScore: cursor.score ?? 0,
      totalStops: 0,
    },
  };
}
