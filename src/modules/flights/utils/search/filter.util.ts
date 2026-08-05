import type { PreprocessedFlightOffer } from '../../types/flights.types';

export type DurationBucket = 'UP_TO_5H' | 'FROM_5_TO_10H' | 'FROM_10_TO_15H' | 'OVER_15H';

export type FlightSearchFilters = {
  minPrice?: number;
  maxPrice?: number;
  stops?: number[];
  airlines?: string[];
  durations?: DurationBucket[];
};

const DURATION_BUCKETS: Array<{
  id: DurationBucket;
  label: string;
  matches: (minutes: number) => boolean;
}> = [
  { id: 'UP_TO_5H', label: 'Up to 5h', matches: (minutes) => minutes <= 300 },
  {
    id: 'FROM_5_TO_10H',
    label: '5–10h',
    matches: (minutes) => minutes > 300 && minutes <= 600,
  },
  {
    id: 'FROM_10_TO_15H',
    label: '10–15h',
    matches: (minutes) => minutes > 600 && minutes <= 900,
  },
  { id: 'OVER_15H', label: '15h+', matches: (minutes) => minutes > 900 },
];

const DURATION_BUCKET_SET = new Set<DurationBucket>(DURATION_BUCKETS.map((bucket) => bucket.id));

function parseCsv(value?: string): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

export function parseFlightSearchFilters(query: {
  minPrice?: number;
  maxPrice?: number;
  stops?: string;
  airlines?: string;
  durations?: string;
}): FlightSearchFilters {
  const filters: FlightSearchFilters = {};

  if (query.minPrice !== undefined && Number.isFinite(query.minPrice)) {
    filters.minPrice = query.minPrice;
  }

  if (query.maxPrice !== undefined && Number.isFinite(query.maxPrice)) {
    filters.maxPrice = query.maxPrice;
  }

  const stops = parseCsv(query.stops)
    ?.map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (stops?.length) {
    filters.stops = stops;
  }

  const airlines = parseCsv(query.airlines);
  if (airlines?.length) {
    filters.airlines = airlines.map((airline) => airline.toUpperCase());
  }

  const durations = parseCsv(query.durations)?.filter((value): value is DurationBucket =>
    DURATION_BUCKET_SET.has(value as DurationBucket),
  );

  if (durations?.length) {
    filters.durations = durations;
  }

  return normalizePriceFilters(filters);
}

export function hasActiveFlightFilters(filters: FlightSearchFilters): boolean {
  return (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    Boolean(filters.stops?.length) ||
    Boolean(filters.airlines?.length) ||
    Boolean(filters.durations?.length)
  );
}

function normalizeAirlineCode(value?: string | null): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return value.trim().toUpperCase();
}

function getSegmentAirlineCode(
  segment: PreprocessedFlightOffer['itineraries'][number]['segments'][number],
): string | undefined {
  return (
    normalizeAirlineCode(segment.airlineIata) ??
    normalizeAirlineCode(segment.carrierCode) ??
    normalizeAirlineCode(segment.operating?.carrierCode)
  );
}

function getOfferAirlineFacets(offer: PreprocessedFlightOffer): Map<string, string> {
  const airlines = new Map<string, string>();

  for (const itinerary of offer.itineraries) {
    for (const segment of itinerary.segments) {
      const airlineCode = getSegmentAirlineCode(segment);
      if (!airlineCode || airlines.has(airlineCode)) {
        continue;
      }

      const airlineName = segment.airline?.trim();
      airlines.set(airlineCode, airlineName || airlineCode);
    }
  }

  return airlines;
}

function getOfferAirlines(offer: PreprocessedFlightOffer): Set<string> {
  return new Set(getOfferAirlineFacets(offer).keys());
}

function normalizePriceFilters(filters: FlightSearchFilters): FlightSearchFilters {
  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    return {
      ...filters,
      minPrice: filters.maxPrice,
      maxPrice: filters.minPrice,
    };
  }

  return filters;
}

export function applyFlightFilters(
  offers: PreprocessedFlightOffer[],
  filters: FlightSearchFilters,
): PreprocessedFlightOffer[] {
  const normalizedFilters = normalizePriceFilters(filters);

  if (!hasActiveFlightFilters(normalizedFilters)) {
    return offers;
  }

  return offers.filter((offer) => {
    const price = Number(offer.price.total);

    if (normalizedFilters.minPrice !== undefined) {
      if (Number.isNaN(price) || price < normalizedFilters.minPrice) {
        return false;
      }
    }

    if (normalizedFilters.maxPrice !== undefined) {
      if (Number.isNaN(price) || price > normalizedFilters.maxPrice) {
        return false;
      }
    }

    if (normalizedFilters.stops?.length) {
      if (!normalizedFilters.stops.includes(offer.preprocessed.totalStops)) {
        return false;
      }
    }

    if (normalizedFilters.airlines?.length) {
      const offerAirlines = getOfferAirlines(offer);
      const matchesAirline = normalizedFilters.airlines.some((airline) =>
        offerAirlines.has(airline),
      );

      if (!matchesAirline) {
        return false;
      }
    }

    if (normalizedFilters.durations?.length) {
      const duration = offer.preprocessed.totalDurationMinutes;
      const matchesDuration = normalizedFilters.durations.some((bucketId) => {
        const bucket = DURATION_BUCKETS.find((item) => item.id === bucketId);
        return bucket ? bucket.matches(duration) : false;
      });

      if (!matchesDuration) {
        return false;
      }
    }

    return true;
  });
}

export function buildFilters(offers: PreprocessedFlightOffer[]) {
  const airlinesMap = new Map<string, { name: string; count: number }>();
  const stopsMap = new Map<number, number>();
  const durationsMap = new Map<DurationBucket, number>();
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const offer of offers) {
    const offerAirlines = getOfferAirlineFacets(offer);

    for (const [code, name] of offerAirlines) {
      const current = airlinesMap.get(code);
      airlinesMap.set(code, {
        name: current?.name ?? name,
        count: (current?.count ?? 0) + 1,
      });
    }

    const stops = offer.preprocessed.totalStops;
    stopsMap.set(stops, (stopsMap.get(stops) ?? 0) + 1);

    const price = Number(offer.price.total);
    if (!Number.isNaN(price)) {
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    }

    const duration = offer.preprocessed.totalDurationMinutes;
    for (const bucket of DURATION_BUCKETS) {
      if (bucket.matches(duration)) {
        durationsMap.set(bucket.id, (durationsMap.get(bucket.id) ?? 0) + 1);
      }
    }
  }

  return {
    airlines: Array.from(airlinesMap.entries())
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    stops: Array.from(stopsMap.entries())
      .map(([stops, count]) => ({ stops, count }))
      .sort((a, b) => a.stops - b.stops),
    durations: DURATION_BUCKETS.map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      count: durationsMap.get(bucket.id) ?? 0,
    })).filter((bucket) => bucket.count > 0),
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    maxPrice,
  };
}

export function appendFiltersToSearchParams(
  params: URLSearchParams,
  filters: FlightSearchFilters,
): void {
  if (filters.minPrice !== undefined) {
    params.set('minPrice', String(filters.minPrice));
  }

  if (filters.maxPrice !== undefined) {
    params.set('maxPrice', String(filters.maxPrice));
  }

  if (filters.stops?.length) {
    params.set('stops', filters.stops.join(','));
  }

  if (filters.airlines?.length) {
    params.set('airlines', filters.airlines.join(','));
  }

  if (filters.durations?.length) {
    params.set('durations', filters.durations.join(','));
  }
}
