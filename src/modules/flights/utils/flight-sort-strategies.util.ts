import {
  type PreprocessedFlightOffer,
  type SortStrategy,
  type SortType,
} from '../types/flights.types';

export const FLIGHT_SORT_STRATEGIES: Record<SortType, SortStrategy> = {
  CHEAPEST: {
    getPrimaryValue: (o) => Number(o.price.total),
    compare: (a, b) => {
      const priceDiff = Number(a.price.total) - Number(b.price.total);
      if (priceDiff !== 0) return priceDiff;

      const durationDiff =
        a.preprocessed.totalDurationMinutes - b.preprocessed.totalDurationMinutes;
      if (durationDiff !== 0) return durationDiff;

      return a.preprocessed.departureTimestamp - b.preprocessed.departureTimestamp;
    },
  },
  FASTEST: {
    getPrimaryValue: (o) => o.preprocessed.totalDurationMinutes,
    compare: (a, b) => {
      const durationDiff =
        a.preprocessed.totalDurationMinutes - b.preprocessed.totalDurationMinutes;
      if (durationDiff !== 0) return durationDiff;

      const priceDiff = Number(a.price.total) - Number(b.price.total);
      if (priceDiff !== 0) return priceDiff;

      return a.preprocessed.departureTimestamp - b.preprocessed.departureTimestamp;
    },
  },
  BEST: {
    getPrimaryValue: (o) => o.preprocessed.bestScore ?? 0,
    compare: (a, b) => {
      const scoreDiff = (a.preprocessed.bestScore ?? 0) - (b.preprocessed.bestScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      const departureDiff = a.preprocessed.departureTimestamp - b.preprocessed.departureTimestamp;
      if (departureDiff !== 0) return departureDiff;

      const priceDiff = Number(a.price.total) - Number(b.price.total);
      if (priceDiff !== 0) return priceDiff;

      const durationDiff =
        a.preprocessed.totalDurationMinutes - b.preprocessed.totalDurationMinutes;
      if (durationDiff !== 0) return durationDiff;

      return 0;
    },
  },
  DEPARTURE: {
    getPrimaryValue: (o) => o.preprocessed.departureTimestamp,
    compare: (a, b) => {
      const depDiff = a.preprocessed.departureTimestamp - b.preprocessed.departureTimestamp;
      if (depDiff !== 0) return depDiff;

      const priceDiff = Number(a.price.total) - Number(b.price.total);
      if (priceDiff !== 0) return priceDiff;

      return a.preprocessed.totalDurationMinutes - b.preprocessed.totalDurationMinutes;
    },
  },
  ARRIVAL: {
    getPrimaryValue: (o) => o.preprocessed.arrivalTimestamp,
    compare: (a, b) => {
      const arrDiff = a.preprocessed.arrivalTimestamp - b.preprocessed.arrivalTimestamp;
      if (arrDiff !== 0) return arrDiff;

      const priceDiff = Number(a.price.total) - Number(b.price.total);
      if (priceDiff !== 0) return priceDiff;

      return a.preprocessed.totalDurationMinutes - b.preprocessed.totalDurationMinutes;
    },
  },
};

export function getFlightSortStrategy(sort: SortType): SortStrategy {
  return FLIGHT_SORT_STRATEGIES[sort] ?? FLIGHT_SORT_STRATEGIES.CHEAPEST;
}

export function sortFlightOffers(
  offers: PreprocessedFlightOffer[],
  sort: SortType,
): PreprocessedFlightOffer[] {
  const strategy = getFlightSortStrategy(sort);

  return [...offers].sort((a, b) => {
    const diff = strategy.compare(a, b);
    if (diff !== 0) return diff;

    return a.id.localeCompare(b.id);
  });
}
