import {
  buildConnectionLegs,
  buildRoundTripLegs,
  extractFlightInstanceIds,
  mergeRoundTripLegs,
  resolvePrimaryFlightInstanceId,
} from './offer-flight-instances.util';
import type { FlightOffer } from '../../interfaces/flight-offers.interface';

describe('offer-flight-instances.util', () => {
  const roundTripOffer: FlightOffer = {
    id: 'outbound_1_return_2',
    legs: buildRoundTripLegs('outbound_1', 'return_2'),
    numberOfBookableSeats: 2,
    itineraries: [
      {
        duration: 'PT2H',
        segments: [
          {
            id: 'seg_out',
            flightInstanceId: 'outbound_1',
            from: 'SVO',
            to: 'LED',
            departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00.000Z' },
            arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00.000Z' },
            carrierCode: 'SU',
            number: '100',
            airline: 'Aeroflot',
            airlineIata: 'SU',
            aircraft: '320',
            operating: { carrierCode: 'SU' },
            duration: 'PT2H',
            blacklistedInEU: false,
          },
        ],
      },
      {
        duration: 'PT2H',
        segments: [
          {
            id: 'seg_in',
            flightInstanceId: 'return_2',
            from: 'LED',
            to: 'SVO',
            departure: { iataCode: 'LED', at: '2026-08-10T14:00:00.000Z' },
            arrival: { iataCode: 'SVO', at: '2026-08-10T16:00:00.000Z' },
            carrierCode: 'SU',
            number: '101',
            airline: 'Aeroflot',
            airlineIata: 'SU',
            aircraft: '320',
            operating: { carrierCode: 'SU' },
            duration: 'PT2H',
            blacklistedInEU: false,
          },
        ],
      },
    ],
    price: {
      currency: 'RUB',
      total: '20000.00',
      base: '20000.00',
      grandTotal: '20000.00',
      fees: [],
    },
  };

  it('extracts flight instance ids from legs', () => {
    expect(extractFlightInstanceIds(roundTripOffer)).toEqual(['outbound_1', 'return_2']);
  });

  it('resolves outbound instance as primary', () => {
    expect(resolvePrimaryFlightInstanceId(roundTripOffer)).toBe('outbound_1');
  });

  it('falls back to segments when legs are missing', () => {
    const { legs: _legs, ...offerWithoutLegs } = roundTripOffer;

    expect(extractFlightInstanceIds(offerWithoutLegs)).toEqual(['outbound_1', 'return_2']);
  });

  it('merges connection outbound with direct return for round-trip booking', () => {
    const outboundConnection: FlightOffer = {
      id: 'leg_a_leg_b',
      legs: buildConnectionLegs('leg_a', 'leg_b'),
      numberOfBookableSeats: 5,
      itineraries: [
        {
          duration: 'PT4H',
          segments: [
            {
              id: 'seg_a',
              flightInstanceId: 'leg_a',
              from: 'SVO',
              to: 'KZN',
              departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00.000Z' },
              arrival: { iataCode: 'KZN', at: '2026-08-01T12:00:00.000Z' },
              carrierCode: 'SU',
              number: '100',
              airline: 'Aeroflot',
              airlineIata: 'SU',
              aircraft: '320',
              operating: { carrierCode: 'SU' },
              duration: 'PT2H',
              blacklistedInEU: false,
            },
            {
              id: 'seg_b',
              flightInstanceId: 'leg_b',
              from: 'KZN',
              to: 'LED',
              departure: { iataCode: 'KZN', at: '2026-08-01T13:00:00.000Z' },
              arrival: { iataCode: 'LED', at: '2026-08-01T15:00:00.000Z' },
              carrierCode: 'SU',
              number: '101',
              airline: 'Aeroflot',
              airlineIata: 'SU',
              aircraft: '320',
              operating: { carrierCode: 'SU' },
              duration: 'PT2H',
              blacklistedInEU: false,
            },
          ],
        },
      ],
      price: {
        currency: 'RUB',
        total: '12000.00',
        base: '12000.00',
        grandTotal: '12000.00',
        fees: [],
      },
    };

    const returnDirect: FlightOffer = {
      id: 'return_2',
      legs: [{ flightInstanceId: 'return_2', direction: 'OUTBOUND' }],
      numberOfBookableSeats: 5,
      itineraries: roundTripOffer.itineraries.slice(1),
      price: roundTripOffer.price,
    };

    const merged = mergeRoundTripLegs(outboundConnection, returnDirect);
    const combinedOffer: FlightOffer = {
      id: `${outboundConnection.id}_${returnDirect.id}`,
      legs: merged,
      numberOfBookableSeats: 5,
      itineraries: [...outboundConnection.itineraries, ...returnDirect.itineraries],
      price: roundTripOffer.price,
    };

    expect(merged).toEqual([
      { flightInstanceId: 'leg_a', direction: 'OUTBOUND' },
      { flightInstanceId: 'leg_b', direction: 'OUTBOUND' },
      { flightInstanceId: 'return_2', direction: 'INBOUND' },
    ]);
    expect(extractFlightInstanceIds(combinedOffer)).toEqual(['leg_a', 'leg_b', 'return_2']);
  });
});
