import { calculateDoorToDoorDurationMinutes, calculateDuration } from './duration.util';
import type { BuiltSegment } from 'src/modules/bookings/types/segment.types';

function buildSegment(duration: string): BuiltSegment {
  return {
    id: 'seg_1',
    flightInstanceId: 'fi_1',
    from: 'HEL',
    to: 'FRA',
    departure: { iataCode: 'HEL', at: '2026-04-01T10:00:00.000Z' },
    arrival: { iataCode: 'FRA', at: '2026-04-01T12:00:00.000Z' },
    carrierCode: 'LH',
    number: '123',
    airline: 'Lufthansa',
    airlineIata: 'LH',
    aircraft: null,
    operating: { carrierCode: 'LH' },
    duration,
    blacklistedInEU: false,
  };
}

describe('duration.util', () => {
  describe('calculateDuration', () => {
    it('sums segment flight times only', () => {
      const segments = [buildSegment('PT2H'), buildSegment('PT3H')];

      expect(calculateDuration(segments)).toBe(300);
    });
  });

  describe('calculateDoorToDoorDurationMinutes', () => {
    it('includes layover time between segments', () => {
      const departure = '2026-04-01T10:00:00.000Z';
      const arrival = '2026-04-01T18:30:00.000Z';

      expect(calculateDoorToDoorDurationMinutes(departure, arrival)).toBe(510);
    });
  });
});
