import { mapItinerary } from './itinerary.mapper';
import type { Itinerary } from '../../interfaces/flight-offers.interface';

describe('mapItinerary', () => {
  it('uses door-to-door duration including layovers', () => {
    const itinerary: Itinerary = {
      duration: 'PT8H30M',
      segments: [
        {
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
          duration: 'PT2H',
          blacklistedInEU: false,
        },
        {
          id: 'seg_2',
          flightInstanceId: 'fi_2',
          from: 'FRA',
          to: 'JFK',
          departure: { iataCode: 'FRA', at: '2026-04-01T15:00:00.000Z' },
          arrival: { iataCode: 'JFK', at: '2026-04-01T18:30:00.000Z' },
          carrierCode: 'LH',
          number: '456',
          airline: 'Lufthansa',
          airlineIata: 'LH',
          aircraft: null,
          operating: { carrierCode: 'LH' },
          duration: 'PT3H30M',
          blacklistedInEU: false,
        },
      ],
    };

    const mapped = mapItinerary(itinerary);

    expect(mapped.durationMinutes).toBe(510);
    expect(mapped.stops).toBe(1);
    expect(mapped.segments[0]).toMatchObject({
      airlineName: 'Lufthansa',
      airlineIata: 'LH',
      airline: 'LH',
      flightNumber: '123',
    });
  });
});
