import { PassengerType } from '@prisma/client';
import type { FlightTraveler } from 'src/modules/flights/dtos/flight-pricing.response.dto';
import {
  createTravelerPricingResolver,
  sortTravelersForPricingMatch,
} from './resolve-traveler-pricing.util';

function pricing(type: PassengerType, travelerId: string, base: string): FlightTraveler {
  return {
    travelerId,
    fareOption: 'STANDARD',
    travelerType: type,
    price: {
      currency: 'RUB',
      total: base,
      base,
    },
    fareDetailsBySegment: [],
  };
}

describe('resolve-traveler-pricing.util', () => {
  const pricingTravelers = [
    pricing(PassengerType.ADULT, '1', '10000'),
    pricing(PassengerType.ADULT, '2', '10000'),
    pricing(PassengerType.CHILD, '3', '7000'),
  ];

  it('sorts travelers in the same order as pricing travelers are built', () => {
    const sorted = sortTravelersForPricingMatch([
      {
        id: 'child-db',
        passengerType: PassengerType.CHILD,
        createdAt: new Date('2026-01-03'),
      },
      {
        id: 'adult-2-db',
        passengerType: PassengerType.ADULT,
        createdAt: new Date('2026-01-02'),
      },
      {
        id: 'adult-1-db',
        passengerType: PassengerType.ADULT,
        createdAt: new Date('2026-01-01'),
      },
    ]);

    expect(sorted.map((traveler) => traveler.id)).toEqual(['adult-1-db', 'adult-2-db', 'child-db']);
  });

  it('matches pricing by passenger type instead of DB array index', () => {
    const resolvePricing = createTravelerPricingResolver(pricingTravelers);
    const travelers = sortTravelersForPricingMatch([
      {
        id: 'child-db',
        passengerType: PassengerType.CHILD,
        createdAt: new Date('2026-01-03'),
      },
      {
        id: 'adult-2-db',
        passengerType: PassengerType.ADULT,
        createdAt: new Date('2026-01-02'),
      },
      {
        id: 'adult-1-db',
        passengerType: PassengerType.ADULT,
        createdAt: new Date('2026-01-01'),
      },
    ]);

    expect(resolvePricing(travelers[0].passengerType)?.travelerId).toBe('1');
    expect(resolvePricing(travelers[1].passengerType)?.travelerId).toBe('2');
    expect(resolvePricing(travelers[2].passengerType)?.travelerId).toBe('3');
  });
});
