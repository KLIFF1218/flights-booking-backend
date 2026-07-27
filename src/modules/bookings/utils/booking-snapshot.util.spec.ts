import { BadRequestException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import {
  assertOfferContextMatches,
  applyPricingToSnapshot,
  assertPaymentProviderSupported,
  extractRouteFromSnapshot,
  resolveOfferContextFromSnapshot,
  resolvePaymentProvider,
  resolvePaymentProviderFromSnapshot,
} from './booking-snapshot.util';
import type { BookingSnapshot } from '../interfaces/booking-snapshot.interface';

const baseSnapshot = {
  offer: {
    id: 'offer-1',
    currencyCode: 'RUB',
    numberOfBookableSeats: 9,
    price: {
      total: '10000',
      currency: 'RUB',
      base: '8000',
      grandTotal: '10000',
    },
    itineraries: [
      {
        duration: 'PT2H',
        segments: [
          {
            id: 'seg-1',
            number: '100',
            carrierCode: 'SU',
            departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
            arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
            duration: 'PT2H',
          },
        ],
      },
    ],
    travelerPricings: [],
  },
  pricing: {
    id: 'pricing-1',
    price: {
      base: 8000,
      taxes: 1500,
      fees: 500,
      seats: 0,
      total: 10000,
      currency: 'RUB',
      taxItems: [],
      feeItems: [],
    },
    travelers: [],
  },
} as unknown as BookingSnapshot;

describe('resolveOfferContextFromSnapshot', () => {
  it('returns searchId and offerId from snapshot', () => {
    const snapshot = {
      ...baseSnapshot,
      searchId: 'search-1',
      offerId: 'offer-1',
    } as unknown as BookingSnapshot;

    expect(resolveOfferContextFromSnapshot(snapshot)).toEqual({
      searchId: 'search-1',
      offerId: 'offer-1',
    });
  });

  it('falls back to offer.id when offerId is missing', () => {
    const snapshot = {
      ...baseSnapshot,
      searchId: 'search-1',
    } as unknown as BookingSnapshot;

    expect(resolveOfferContextFromSnapshot(snapshot)).toEqual({
      searchId: 'search-1',
      offerId: 'offer-1',
    });
  });

  it('throws when searchId is missing', () => {
    expect(() => resolveOfferContextFromSnapshot(baseSnapshot)).toThrow(BadRequestException);
  });
});

describe('assertOfferContextMatches', () => {
  const snapshot = {
    ...baseSnapshot,
    searchId: 'search-1',
    offerId: 'offer-1',
  } as unknown as BookingSnapshot;

  it('returns offer context when client values match snapshot', () => {
    expect(assertOfferContextMatches(snapshot, 'search-1', 'offer-1')).toEqual({
      searchId: 'search-1',
      offerId: 'offer-1',
    });
  });

  it('throws when client searchId does not match snapshot', () => {
    expect(() => assertOfferContextMatches(snapshot, 'search-2', 'offer-1')).toThrow(
      BadRequestException,
    );
  });

  it('throws when client offerId does not match snapshot', () => {
    expect(() => assertOfferContextMatches(snapshot, 'search-1', 'offer-2')).toThrow(
      BadRequestException,
    );
  });
});

describe('resolvePaymentProvider', () => {
  it('defaults to STRIPE when not specified', () => {
    expect(resolvePaymentProvider()).toBe(PaymentProvider.STRIPE);
  });

  it('returns the provided provider', () => {
    expect(resolvePaymentProvider(PaymentProvider.STRIPE)).toBe(PaymentProvider.STRIPE);
  });
});

describe('assertPaymentProviderSupported', () => {
  it.each([PaymentProvider.YOOKASSA, PaymentProvider.STRIPE])(
    'allows supported provider %s',
    (provider) => {
      expect(() => assertPaymentProviderSupported(provider)).not.toThrow();
    },
  );

  it('rejects unsupported provider', () => {
    expect(() => assertPaymentProviderSupported(PaymentProvider.STARS)).toThrow(
      BadRequestException,
    );
  });
});

describe('resolvePaymentProviderFromSnapshot', () => {
  it('returns payment provider from snapshot', () => {
    const snapshot = {
      ...baseSnapshot,
      paymentProvider: PaymentProvider.STRIPE,
    } as unknown as BookingSnapshot;

    expect(resolvePaymentProviderFromSnapshot(snapshot)).toBe(PaymentProvider.STRIPE);
  });

  it('defaults to STRIPE when snapshot has no payment provider', () => {
    expect(resolvePaymentProviderFromSnapshot(baseSnapshot)).toBe(PaymentProvider.STRIPE);
  });
});

describe('applyPricingToSnapshot', () => {
  it('updates pricing and offer totals in snapshot', () => {
    const pricing = {
      id: 'pricing-2',
      price: {
        base: 8000,
        taxes: 1500,
        fees: 500,
        seats: 1200,
        total: 11200,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    };

    const updated = applyPricingToSnapshot(baseSnapshot, pricing as any);

    expect(updated.pricing).toEqual(pricing);
    expect(updated.offer.price.total).toBe('11200.00');
    expect(updated.offer.price.grandTotal).toBe('11200.00');
  });
});

describe('extractRouteFromSnapshot', () => {
  it('returns origin and destination from first and last segments across itineraries', () => {
    const snapshot = {
      ...baseSnapshot,
      offer: {
        ...baseSnapshot.offer,
        itineraries: [
          {
            duration: 'PT5H',
            segments: [
              {
                id: 'seg-1',
                number: '100',
                carrierCode: 'SU',
                departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
                arrival: { iataCode: 'IST', at: '2026-08-01T13:00:00' },
                duration: 'PT3H',
              },
              {
                id: 'seg-2',
                number: '200',
                carrierCode: 'TK',
                departure: { iataCode: 'IST', at: '2026-08-01T15:00:00' },
                arrival: { iataCode: 'CDG', at: '2026-08-01T18:00:00' },
                duration: 'PT3H',
              },
            ],
          },
        ],
      },
    } as unknown as BookingSnapshot;

    const route = extractRouteFromSnapshot(snapshot);

    expect(route.origin).toBe('SVO');
    expect(route.destination).toBe('CDG');
    expect(route.firstSegment.id).toBe('seg-1');
  });

  it('throws when itinerary segments are missing', () => {
    const snapshot = {
      ...baseSnapshot,
      offer: {
        ...baseSnapshot.offer,
        itineraries: [],
      },
    } as unknown as BookingSnapshot;

    expect(() => extractRouteFromSnapshot(snapshot)).toThrow(BadRequestException);
  });
});
