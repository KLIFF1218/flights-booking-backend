import type { PreprocessedFlightOffer } from '../types/flights.types';
import { applyFlightFilters, buildFilters, parseFlightSearchFilters } from './filter.util';

function buildOffer(params: {
  id: string;
  price: number;
  stops: number;
  durationMinutes: number;
  airlineIata: string;
}): PreprocessedFlightOffer {
  return {
    id: params.id,
    numberOfBookableSeats: 9,
    price: {
      total: String(params.price),
      currency: 'RUB',
      base: String(params.price),
      grandTotal: String(params.price),
    },
    itineraries: [
      {
        duration: `PT${params.durationMinutes}M`,
        segments: [
          {
            id: `${params.id}_seg`,
            flightInstanceId: `${params.id}_fi`,
            from: 'SVO',
            to: 'LED',
            departure: { iataCode: 'SVO', at: '2026-04-01T10:00:00.000Z' },
            arrival: { iataCode: 'LED', at: '2026-04-01T12:00:00.000Z' },
            carrierCode: params.airlineIata,
            number: '100',
            airline: 'Test Airline',
            airlineIata: params.airlineIata,
            aircraft: null,
            operating: { carrierCode: params.airlineIata },
            duration: `PT${params.durationMinutes}M`,
            blacklistedInEU: false,
          },
        ],
      },
    ],
    preprocessed: {
      totalDurationMinutes: params.durationMinutes,
      departureTimestamp: Date.parse('2026-04-01T10:00:00.000Z'),
      arrivalTimestamp: Date.parse('2026-04-01T12:00:00.000Z'),
      totalStops: params.stops,
    },
  };
}

const OFFERS = [
  buildOffer({ id: '1', price: 5000, stops: 0, durationMinutes: 120, airlineIata: 'SU' }),
  buildOffer({ id: '2', price: 8000, stops: 1, durationMinutes: 360, airlineIata: 'DP' }),
  buildOffer({ id: '3', price: 12000, stops: 2, durationMinutes: 720, airlineIata: 'S7' }),
  buildOffer({ id: '4', price: 20000, stops: 0, durationMinutes: 960, airlineIata: 'SU' }),
];

describe('filter.util', () => {
  describe('parseFlightSearchFilters', () => {
    it('parses csv filters and normalizes airline codes', () => {
      expect(
        parseFlightSearchFilters({
          minPrice: 1000,
          maxPrice: 9000,
          stops: '0,1',
          airlines: 'su,dp',
          durations: 'UP_TO_5H,FROM_5_TO_10H',
        }),
      ).toEqual({
        minPrice: 1000,
        maxPrice: 9000,
        stops: [0, 1],
        airlines: ['SU', 'DP'],
        durations: ['UP_TO_5H', 'FROM_5_TO_10H'],
      });
    });

    it('swaps reversed price bounds', () => {
      expect(
        parseFlightSearchFilters({
          minPrice: 9000,
          maxPrice: 1000,
        }),
      ).toEqual({
        minPrice: 1000,
        maxPrice: 9000,
      });
    });

    it('ignores invalid duration buckets', () => {
      expect(
        parseFlightSearchFilters({
          durations: 'UP_TO_5H,INVALID',
        }),
      ).toEqual({
        durations: ['UP_TO_5H'],
      });
    });
  });

  describe('applyFlightFilters', () => {
    it('filters by min and max price', () => {
      const result = applyFlightFilters(OFFERS, { minPrice: 7000, maxPrice: 15000 });

      expect(result.map((offer) => offer.id)).toEqual(['2', '3']);
    });

    it('filters by stops', () => {
      const result = applyFlightFilters(OFFERS, { stops: [0] });

      expect(result.map((offer) => offer.id)).toEqual(['1', '4']);
    });

    it('filters by airline iata code', () => {
      const result = applyFlightFilters(OFFERS, { airlines: ['SU'] });

      expect(result.map((offer) => offer.id)).toEqual(['1', '4']);
    });

    it('filters by duration buckets', () => {
      const result = applyFlightFilters(OFFERS, { durations: ['UP_TO_5H'] });

      expect(result.map((offer) => offer.id)).toEqual(['1']);
    });

    it('combines filters with AND semantics', () => {
      const result = applyFlightFilters(OFFERS, {
        minPrice: 4000,
        maxPrice: 10000,
        stops: [1],
        airlines: ['DP'],
        durations: ['FROM_5_TO_10H'],
      });

      expect(result.map((offer) => offer.id)).toEqual(['2']);
    });

    it('returns all offers when filters are empty', () => {
      expect(applyFlightFilters(OFFERS, {})).toHaveLength(4);
    });
  });

  describe('buildFilters', () => {
    it('builds facet metadata from full offer set', () => {
      const facets = buildFilters(OFFERS);

      expect(facets.minPrice).toBe(5000);
      expect(facets.maxPrice).toBe(20000);
      expect(facets.stops).toEqual([
        { stops: 0, count: 2 },
        { stops: 1, count: 1 },
        { stops: 2, count: 1 },
      ]);
      expect(facets.airlines).toEqual(
        expect.arrayContaining([
          { code: 'DP', name: 'Test Airline', count: 1 },
          { code: 'S7', name: 'Test Airline', count: 1 },
          { code: 'SU', name: 'Test Airline', count: 2 },
        ]),
      );
      expect(facets.airlines).toHaveLength(3);
      expect(facets.durations.map((bucket) => bucket.id)).toEqual([
        'UP_TO_5H',
        'FROM_5_TO_10H',
        'FROM_10_TO_15H',
        'OVER_15H',
      ]);
    });
  });
});
