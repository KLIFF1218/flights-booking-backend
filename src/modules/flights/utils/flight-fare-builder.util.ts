import { Currency, FareBrand, PassengerType, Prisma, TravelClass } from '@prisma/client';
import { resolveFareBrandRules } from '../constants/fare-brand.constants';

export const AIRLINES_WITH_FIRST = new Set(['BA', 'LH', 'EK']);

const CHILD_MULTIPLIER = 0.75;
const HELD_INFANT_MULTIPLIER = 0.1;

export type AdultPricesByClass = {
  economy: number;
  premiumEconomy: number;
  business: number;
  first?: number;
};

export function airlineSupportsFirstClass(airlineCode: string): boolean {
  return AIRLINES_WITH_FIRST.has(airlineCode.trim().toUpperCase());
}

export function getRequiredTravelClasses(airlineCode: string): TravelClass[] {
  const classes: TravelClass[] = [
    TravelClass.ECONOMY,
    TravelClass.PREMIUM_ECONOMY,
    TravelClass.BUSINESS,
  ];

  if (airlineSupportsFirstClass(airlineCode)) {
    classes.push(TravelClass.FIRST);
  }

  return classes;
}

function roundMoney(value: number): number {
  return +value.toFixed(2);
}

function passengerRowsForBrand(
  instanceId: string,
  travelClass: TravelClass,
  fareBrand: FareBrand,
  adultListPrice: number,
  currency: Currency,
): Prisma.FlightFareCreateManyInput[] {
  const rules = resolveFareBrandRules(fareBrand, travelClass);
  const adultPrice = roundMoney(adultListPrice * rules.priceMultiplier);
  const childPrice = roundMoney(adultPrice * CHILD_MULTIPLIER);
  const infantPrice = roundMoney(adultPrice * HELD_INFANT_MULTIPLIER);
  const bags = rules.checkedBags;
  const fareBasis = `${travelClass}_${fareBrand}`;

  return [
    {
      flightInstanceId: instanceId,
      passengerType: PassengerType.ADULT,
      travelClass,
      fareBrand,
      basePrice: adultPrice,
      currency,
      checkedBags: bags,
      changeable: rules.changeable,
      refundable: rules.refundable,
      fareBasis,
    },
    {
      flightInstanceId: instanceId,
      passengerType: PassengerType.CHILD,
      travelClass,
      fareBrand,
      basePrice: childPrice,
      currency,
      checkedBags: bags,
      changeable: rules.changeable,
      refundable: rules.refundable,
      fareBasis,
    },
    {
      flightInstanceId: instanceId,
      passengerType: PassengerType.HELD_INFANT,
      travelClass,
      fareBrand,
      basePrice: infantPrice,
      currency,
      checkedBags: 0,
      changeable: rules.changeable,
      refundable: rules.refundable,
      fareBasis,
    },
    {
      flightInstanceId: instanceId,
      passengerType: PassengerType.SEATED_INFANT,
      travelClass,
      fareBrand,
      basePrice: childPrice,
      currency,
      checkedBags: bags,
      changeable: rules.changeable,
      refundable: rules.refundable,
      fareBasis,
    },
  ];
}

function passengerRowsForClass(
  instanceId: string,
  travelClass: TravelClass,
  adultPrice: number,
  currency: Currency,
): Prisma.FlightFareCreateManyInput[] {
  return [
    ...passengerRowsForBrand(instanceId, travelClass, FareBrand.LIGHT, adultPrice, currency),
    ...passengerRowsForBrand(instanceId, travelClass, FareBrand.FLEX, adultPrice, currency),
  ];
}

function adultPriceForClass(
  prices: AdultPricesByClass,
  travelClass: TravelClass,
): number | undefined {
  switch (travelClass) {
    case TravelClass.ECONOMY:
      return prices.economy;
    case TravelClass.PREMIUM_ECONOMY:
      return prices.premiumEconomy;
    case TravelClass.BUSINESS:
      return prices.business;
    case TravelClass.FIRST:
      return prices.first;
    default:
      return undefined;
  }
}

export function buildFlightFaresFromAdultPrices(params: {
  instanceId: string;
  currency: Currency;
  airlineCode: string;
  adultPrices: AdultPricesByClass;
}): Prisma.FlightFareCreateManyInput[] {
  const fares: Prisma.FlightFareCreateManyInput[] = [];

  for (const travelClass of getRequiredTravelClasses(params.airlineCode)) {
    const adultPrice = adultPriceForClass(params.adultPrices, travelClass);

    if (adultPrice === undefined) {
      throw new Error(`Missing adult price for travel class ${travelClass}`);
    }

    fares.push(
      ...passengerRowsForClass(params.instanceId, travelClass, adultPrice, params.currency),
    );
  }

  return fares;
}
