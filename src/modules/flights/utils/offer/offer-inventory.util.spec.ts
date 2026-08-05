import { FlightStatus } from '@prisma/client';
import type { FlightOffer } from '../../interfaces/flight-offers.interface';
import { isOfferInventoryBookable, resolveOfferBookableSeats } from './offer-inventory.util';

function buildOffer(instanceId: string, seats = 10): FlightOffer {
  return {
    id: 'offer-1',
    numberOfBookableSeats: seats,
    price: {
      total: '100',
      currency: 'USD',
      base: '90',
      grandTotal: '100',
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
            departure: { iataCode: 'SVO', at: '2026-04-01T10:00:00.000Z' },
            arrival: { iataCode: 'LED', at: '2026-04-01T12:00:00.000Z' },
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

describe('offer-inventory.util', () => {
  const instancesMap = new Map([
    [
      'fi-1',
      {
        id: 'fi-1',
        status: FlightStatus.SCHEDULED,
        seatsAvailable: 3,
      },
    ],
  ]);

  it('resolves live bookable seats from instances', () => {
    expect(resolveOfferBookableSeats(buildOffer('fi-1', 10), instancesMap as any)).toBe(3);
  });

  it('rejects offers when any leg is cancelled', () => {
    const cancelledMap = new Map([
      [
        'fi-1',
        {
          id: 'fi-1',
          status: FlightStatus.CANCELLED,
          seatsAvailable: 3,
        },
      ],
    ]);

    expect(isOfferInventoryBookable(buildOffer('fi-1'), cancelledMap as any, { adults: 1 })).toBe(
      false,
    );
  });

  it('rejects offers without enough seats for the search party', () => {
    expect(
      isOfferInventoryBookable(buildOffer('fi-1'), instancesMap as any, {
        adults: 2,
        children: 2,
      }),
    ).toBe(false);
  });
});
