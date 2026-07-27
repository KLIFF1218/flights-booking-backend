import { BadRequestException } from '@nestjs/common';
import {
  assertValidSearchDirections,
  isDistinctOriginDestination,
  isIsoDateString,
  isReturnDateValid,
  isRoundTripRouteValid,
  isTodayOrFutureIsoDate,
  isValidIataCode,
  normalizeIataCode,
} from './validate-search-directions.util';

describe('validate-search-directions.util', () => {
  const referenceDate = new Date('2026-07-19T12:00:00.000Z');

  describe('normalizeIataCode', () => {
    it('trims and uppercases airport codes', () => {
      expect(normalizeIataCode(' hel ')).toBe('HEL');
    });
  });

  describe('isValidIataCode', () => {
    it('accepts three-letter codes', () => {
      expect(isValidIataCode('jfk')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isValidIataCode('HELX')).toBe(false);
      expect(isValidIataCode('12')).toBe(false);
    });
  });

  describe('isDistinctOriginDestination', () => {
    it('rejects identical airports', () => {
      expect(isDistinctOriginDestination('HEL', 'HEL')).toBe(false);
    });

    it('accepts different airports', () => {
      expect(isDistinctOriginDestination('HEL', 'JFK')).toBe(true);
    });
  });

  describe('isIsoDateString', () => {
    it('accepts valid calendar dates', () => {
      expect(isIsoDateString('2026-04-01')).toBe(true);
    });

    it('rejects invalid calendar dates', () => {
      expect(isIsoDateString('2026-02-30')).toBe(false);
      expect(isIsoDateString('04-01-2026')).toBe(false);
    });
  });

  describe('isTodayOrFutureIsoDate', () => {
    it('accepts today and future dates in the given timezone', () => {
      expect(isTodayOrFutureIsoDate('2026-07-19', referenceDate, 'UTC')).toBe(true);
      expect(isTodayOrFutureIsoDate('2026-07-20', referenceDate, 'UTC')).toBe(true);
    });

    it('rejects past dates in the given timezone', () => {
      expect(isTodayOrFutureIsoDate('2026-07-18', referenceDate, 'UTC')).toBe(false);
    });

    it('uses origin airport local day, not UTC calendar day (west of UTC)', () => {
      // 2026-07-25 01:00 UTC is still 2026-07-24 evening in Los Angeles.
      const now = new Date('2026-07-25T01:00:00.000Z');

      expect(isTodayOrFutureIsoDate('2026-07-24', now, 'America/Los_Angeles')).toBe(true);
      expect(isTodayOrFutureIsoDate('2026-07-24', now, 'UTC')).toBe(false);
    });

    it('uses origin airport local day, not UTC calendar day (east of UTC)', () => {
      // 2026-07-24 22:00 UTC is already 2026-07-25 in Helsinki.
      const now = new Date('2026-07-24T22:00:00.000Z');

      expect(isTodayOrFutureIsoDate('2026-07-24', now, 'Europe/Helsinki')).toBe(false);
      expect(isTodayOrFutureIsoDate('2026-07-25', now, 'Europe/Helsinki')).toBe(true);
      expect(isTodayOrFutureIsoDate('2026-07-24', now, 'UTC')).toBe(true);
    });
  });

  describe('isRoundTripRouteValid', () => {
    it('requires the return leg to reverse the outbound route', () => {
      expect(
        isRoundTripRouteValid(
          { origin: 'HEL', destination: 'JFK' },
          { origin: 'JFK', destination: 'HEL' },
        ),
      ).toBe(true);

      expect(
        isRoundTripRouteValid(
          { origin: 'HEL', destination: 'JFK' },
          { origin: 'HEL', destination: 'JFK' },
        ),
      ).toBe(false);
    });
  });

  describe('isReturnDateValid', () => {
    it('requires the return date to be on or after outbound date', () => {
      expect(isReturnDateValid({ dateFrom: '2026-04-01' }, { dateFrom: '2026-04-07' })).toBe(true);

      expect(isReturnDateValid({ dateFrom: '2026-04-07' }, { dateFrom: '2026-04-01' })).toBe(false);
    });
  });

  describe('assertValidSearchDirections', () => {
    it('accepts a valid one-way search', () => {
      expect(() =>
        assertValidSearchDirections([
          { origin: 'HEL', destination: 'JFK', dateFrom: '2026-08-01' },
        ]),
      ).not.toThrow();
    });

    it('rejects invalid IATA codes', () => {
      expect(() =>
        assertValidSearchDirections([
          { origin: 'HELX', destination: 'JFK', dateFrom: '2026-08-01' },
        ]),
      ).toThrow(new BadRequestException('origin must be a valid IATA code'));
    });

    it('rejects identical origin and destination', () => {
      expect(() =>
        assertValidSearchDirections([
          { origin: 'HEL', destination: 'HEL', dateFrom: '2026-08-01' },
        ]),
      ).toThrow(new BadRequestException('origin and destination must be different'));
    });

    it('rejects past dates in the origin airport timezone', () => {
      expect(() =>
        assertValidSearchDirections([
          { origin: 'HEL', destination: 'JFK', dateFrom: '2020-01-01' },
        ]),
      ).toThrow(
        new BadRequestException(
          'dateFrom must be today or in the future in the origin airport timezone',
        ),
      );
    });

    it('rejects more than two directions', () => {
      expect(() =>
        assertValidSearchDirections([
          { origin: 'HEL', destination: 'JFK', dateFrom: '2026-08-01' },
          { origin: 'JFK', destination: 'HEL', dateFrom: '2026-08-07' },
          { origin: 'HEL', destination: 'LHR', dateFrom: '2026-08-10' },
        ]),
      ).toThrow(new BadRequestException('Only one-way and round-trip searches are supported'));
    });
  });
});
