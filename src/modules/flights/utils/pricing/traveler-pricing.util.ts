import type { Currency, FareBrand, PassengerType, TravelClass } from '@prisma/client';
import type { PassengerCounts, TravelerPricing } from '../../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../../providers/prisma/flight-instance.type';
import { convertCurrency } from './currency.util';
import type { Fare } from '../../types/flights.types';
import { buildFarePriceBreakdown } from './fare-charges.util';
import { DEFAULT_SEARCH_FARE_BRAND } from '../../constants/fare-brand.constants';

export class MissingFareError extends Error {
  constructor(
    public readonly passengerType: PassengerType,
    public readonly travelClass: TravelClass,
    public readonly fareBrand: FareBrand,
  ) {
    super(`Fare not found for ${passengerType} ${travelClass} ${fareBrand}`);
    this.name = 'MissingFareError';
  }
}

function buildFareCacheMap(fares: Fare[], fareBrand: FareBrand) {
  const fareCacheMap = new Map<string, Fare>();
  for (const fare of fares) {
    if (fare.fareBrand !== fareBrand) {
      continue;
    }
    const key = `${fare.passengerType}_${fare.travelClass}`;
    fareCacheMap.set(key, fare);
  }
  return fareCacheMap;
}

function requireFare(
  fareCacheMap: Map<string, Fare>,
  passengerType: PassengerType,
  travelClass: TravelClass,
  fareBrand: FareBrand,
): Fare {
  const fare = fareCacheMap.get(`${passengerType}_${travelClass}`);
  if (!fare) {
    throw new MissingFareError(passengerType, travelClass, fareBrand);
  }
  return fare;
}

function fareTotalForPassengers(
  fareCacheMap: Map<string, Fare>,
  passengerType: PassengerType,
  count: number,
  travelClass: TravelClass,
  fareBrand: FareBrand,
  targetCurrency: Currency,
): number {
  if (!count) {
    return 0;
  }

  const fare = requireFare(fareCacheMap, passengerType, travelClass, fareBrand);
  const priceConverted = convertCurrency(Number(fare.basePrice), fare.currency, targetCurrency);
  return priceConverted * count;
}

function travelerServiceFeePassengerCount(type: PassengerType): number {
  return type === 'HELD_INFANT' ? 0 : 1;
}

export function buildTravelerPriceFromBase(
  baseAmount: number,
  passengerType: PassengerType,
  currency: Currency,
) {
  const breakdown = buildFarePriceBreakdown(
    baseAmount,
    travelerServiceFeePassengerCount(passengerType),
  );

  return {
    currency,
    base: breakdown.base.toFixed(2),
    total: breakdown.total.toFixed(2),
    taxes: breakdown.taxes,
    fees: breakdown.fees,
  };
}

export function buildTravelerPricings(
  instance: FlightInstanceWithRelations,
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
  fareBrand: FareBrand = DEFAULT_SEARCH_FARE_BRAND,
) {
  const travelers: TravelerPricing[] = [];
  let travelerIndex = 1;

  const fareCacheMap = buildFareCacheMap(instance.fares, fareBrand);

  const buildFareSegments = (fare: Fare) => {
    return instance.flight.segments.map((seg) => ({
      segmentId: seg.id,
      cabin: travelClass,
      fareBasis: fare.fareBasis || null,
      brandName: fare.fareBrand,
      changeable: fare.changeable,
      refundable: fare.refundable,
      includedCheckedBags: {
        quantity: fare.checkedBags,
      },
    }));
  };

  const createTravelers = (count: number, type: PassengerType) => {
    if (!count) return;

    const fare = requireFare(fareCacheMap, type, travelClass, fareBrand);

    const basePriceInTarget = convertCurrency(
      Number(fare.basePrice),
      fare.currency,
      targetCurrency,
    );

    for (let i = 0; i < count; i++) {
      travelers.push({
        travelerId: `T${travelerIndex++}`,
        travelerType: type,
        fareOption: fare.fareBrand,
        price: buildTravelerPriceFromBase(basePriceInTarget, type, targetCurrency),
        fareDetailsBySegment: buildFareSegments(fare),
      });
    }
  };

  createTravelers(passengers.adults ?? 0, 'ADULT');
  createTravelers(passengers.children ?? 0, 'CHILD');
  createTravelers(passengers.infants ?? 0, 'HELD_INFANT');
  createTravelers(passengers.seatedInfants ?? 0, 'SEATED_INFANT');

  return travelers;
}

export function calculateTotalPrice(
  instance: FlightInstanceWithRelations,
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
  fareBrand: FareBrand = DEFAULT_SEARCH_FARE_BRAND,
) {
  const fareCacheMap = buildFareCacheMap(instance.fares, fareBrand);

  const base =
    fareTotalForPassengers(
      fareCacheMap,
      'ADULT',
      passengers.adults ?? 0,
      travelClass,
      fareBrand,
      targetCurrency,
    ) +
    fareTotalForPassengers(
      fareCacheMap,
      'CHILD',
      passengers.children ?? 0,
      travelClass,
      fareBrand,
      targetCurrency,
    ) +
    fareTotalForPassengers(
      fareCacheMap,
      'HELD_INFANT',
      passengers.infants ?? 0,
      travelClass,
      fareBrand,
      targetCurrency,
    ) +
    fareTotalForPassengers(
      fareCacheMap,
      'SEATED_INFANT',
      passengers.seatedInfants ?? 0,
      travelClass,
      fareBrand,
      targetCurrency,
    );

  return {
    base,
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
        const mergedBase = Number(existing.price.base) + Number(tp.price.base);

        existing.price = buildTravelerPriceFromBase(
          mergedBase,
          existing.travelerType,
          existing.price.currency,
        );
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
