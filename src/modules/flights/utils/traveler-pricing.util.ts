import type { Currency, PassengerType, TravelClass } from '@prisma/client';
import type { PassengerCounts, TravelerPricing } from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import { convertCurrency } from './currency.util';
import type { Fare } from '../types/flights.types';

export function buildTravelerPricings(
  instance: FlightInstanceWithRelations,
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
) {
  const travelers: TravelerPricing[] = [];
  let travelerIndex = 1;

  const fareCacheMap = new Map<string, Fare>();
  for (const fare of instance.fares) {
    const key = `${fare.passengerType}_${fare.travelClass}`;
    fareCacheMap.set(key, fare);
  }

  const buildFareSegments = (bags: number, fareBasis?: string) => {
    return instance.flight.segments.map((seg) => ({
      segmentId: seg.id,
      cabin: travelClass,
      fareBasis: fareBasis || null,
      brandName: null,
      includedCheckedBags: {
        quantity: bags,
      },
    }));
  };

  const createTravelers = (count: number, type: PassengerType) => {
    const fare = fareCacheMap.get(`${type}_${travelClass}`);
    if (!fare) return;

    const basePriceInTarget = convertCurrency(
      Number(fare.basePrice),
      fare.currency,
      targetCurrency,
    );

    for (let i = 0; i < count; i++) {
      travelers.push({
        travelerId: `T${travelerIndex++}`,
        travelerType: type,
        price: {
          currency: targetCurrency,
          total: basePriceInTarget.toFixed(2),
          base: basePriceInTarget.toFixed(2),
        },
        fareDetailsBySegment: buildFareSegments(fare.checkedBags, fare.fareBasis ?? undefined),
      });
    }
  };

  createTravelers(passengers.adults ?? 0, 'ADULT');
  createTravelers(passengers.children ?? 0, 'CHILD');
  createTravelers(passengers.infants ?? 0, 'HELD_INFANT');

  return travelers;
}

export function calculateTotalPrice(
  instance: FlightInstanceWithRelations,
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
) {
  const fareCacheMap = new Map<string, Fare>();
  for (const fare of instance.fares) {
    const key = `${fare.passengerType}_${fare.travelClass}`;
    fareCacheMap.set(key, fare);
  }

  const adultFare = fareCacheMap.get(`ADULT_${travelClass}`);
  const childFare = fareCacheMap.get(`CHILD_${travelClass}`);
  const infantFare = fareCacheMap.get(`HELD_INFANT_${travelClass}`);

  let total = 0;

  if (adultFare) {
    const priceConverted = convertCurrency(
      Number(adultFare.basePrice),
      adultFare.currency,
      targetCurrency,
    );
    total += priceConverted * (passengers.adults ?? 0);
  }

  if (childFare) {
    const priceConverted = convertCurrency(
      Number(childFare.basePrice),
      childFare.currency,
      targetCurrency,
    );
    total += priceConverted * (passengers.children ?? 0);
  }

  if (infantFare) {
    const priceConverted = convertCurrency(
      Number(infantFare.basePrice),
      infantFare.currency,
      targetCurrency,
    );
    total += priceConverted * (passengers.infants ?? 0);
  }

  return {
    total,
    currency: targetCurrency,
  };
}

export function combineTravelerPricings(
  outbound: TravelerPricing[],
  returnPricings: TravelerPricing[],
): TravelerPricing[] {
  const map = new Map<string, TravelerPricing>();

  outbound.forEach((tp) => {
    map.set(tp.travelerId, { ...tp });
  });

  if (Array.isArray(returnPricings)) {
    returnPricings.forEach((tp) => {
      const existing = map.get(tp.travelerId);
      if (existing) {
        const newTotal = Number(existing.price.total) + Number(tp.price.total);
        existing.price.total = newTotal.toFixed(2);
        existing.price.base = newTotal.toFixed(2);
        existing.fareDetailsBySegment = [
          ...existing.fareDetailsBySegment,
          ...tp.fareDetailsBySegment,
        ];
      } else {
        map.set(tp.travelerId, { ...tp });
      }
    });
  }

  return Array.from(map.values());
}
