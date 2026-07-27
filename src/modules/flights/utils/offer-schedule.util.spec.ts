import { FlightStatus } from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import {
  applyInstanceSchedulesToOffer,
  assertFlightInstancesBookable,
  offerReferencesFlightInstance,
  patchOfferSegmentFromInstance,
} from './offer-schedule.util';

function buildOffer(departureAt: string, arrivalAt: string, instanceId = 'fi-1'): FlightOffer {
  return {
    id: 'offer-1',
    numberOfBookableSeats: 10,
    price: {
      total: '10000',
      currency: 'RUB',
      base: '9000',
      grandTotal: '10000',
    },
    itineraries: [
      {
        duration: 'PT2H',
        segments: [
          {
            id: 'seg-1',
            flightInstanceId: instanceId,
            from: 'SVO',
            to: 'LED',
            departure: { iataCode: 'SVO', at: departureAt },
            arrival: { iataCode: 'LED', at: arrivalAt },
            carrierCode: 'SU',
            number: '100',
            airline: 'Aeroflot',
            airlineIata: 'SU',
            aircraft: null,
            operating: { carrierCode: 'SU' },
            duration: 'PT2H',
            blacklistedInEU: false,
          },
        ],
      },
    ],
  };
}

function buildInstance(departureDate: Date, delayMinutes = 0, status = FlightStatus.DELAYED) {
  return {
    id: 'fi-1',
    departureDate,
    originalDepartureDate: new Date('2026-04-01T10:00:00.000Z'),
    delayMinutes,
    status,
    seatsAvailable: 100,
    flight: {
      durationMinutes: 120,
      departureAirport: { iataCode: 'SVO' },
      arrivalAirport: { iataCode: 'LED' },
      airline: { name: 'Aeroflot', code: 'SU' },
      segments: [
        {
          id: 'seg-1',
          segmentOrder: 0,
          dayOffset: 0,
          departureTime: '10:00',
          durationMinutes: 120,
          flightNumber: '100',
          carrierCode: 'SU',
          departureAirport: { iataCode: 'SVO' },
          arrivalAirport: { iataCode: 'LED' },
          aircraft: null,
        },
      ],
    },
    fares: [],
  };
}

describe('offer-schedule.util', () => {
  it('detects schedule changes when instance departure moved', () => {
    const offer = buildOffer('2026-04-01T10:00:00.000Z', '2026-04-01T12:00:00.000Z');
    const instance = buildInstance(new Date('2026-04-01T10:15:00.000Z'), 15);
    const instancesMap = new Map([[instance.id, instance as never]]);

    const result = applyInstanceSchedulesToOffer(offer, instancesMap);

    expect(result.scheduleChanged).toBe(true);
    expect(result.scheduleChanges).toHaveLength(1);
    expect(result.offer.itineraries[0].segments[0].departure.at).toBe('2026-04-01T10:15:00.000Z');
  });

  it('rejects cancelled instances for booking', () => {
    expect(() =>
      assertFlightInstancesBookable([{ id: 'fi-1', status: FlightStatus.CANCELLED }]),
    ).toThrow('cancelled');
  });

  it('matches offers by flight instance id', () => {
    const offer = buildOffer('2026-04-01T10:00:00.000Z', '2026-04-01T12:00:00.000Z');
    expect(offerReferencesFlightInstance(offer, 'fi-1')).toBe(true);
    expect(offerReferencesFlightInstance(offer, 'fi-2')).toBe(false);
  });

  it('patches a single offer segment from instance', () => {
    const offer = buildOffer('2026-04-01T10:00:00.000Z', '2026-04-01T12:00:00.000Z');
    const instance = buildInstance(new Date('2026-04-01T10:30:00.000Z'), 30);

    const patched = patchOfferSegmentFromInstance(offer, instance as never);

    expect(patched.scheduleChanged).toBe(true);
    expect(patched.offer.itineraries[0].segments[0].departure.at).toBe('2026-04-01T10:30:00.000Z');
  });
});
