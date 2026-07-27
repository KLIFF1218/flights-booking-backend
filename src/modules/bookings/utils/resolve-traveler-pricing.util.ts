import { PassengerType } from '@prisma/client';
import type { FlightTraveler } from 'src/modules/flights/dtos/flight-pricing.response.dto';

const PASSENGER_TYPE_PRICING_ORDER: PassengerType[] = [
  PassengerType.ADULT,
  PassengerType.CHILD,
  PassengerType.HELD_INFANT,
  PassengerType.SEATED_INFANT,
];

function passengerTypeSortIndex(type: PassengerType): number {
  const index = PASSENGER_TYPE_PRICING_ORDER.indexOf(type);

  return index === -1 ? PASSENGER_TYPE_PRICING_ORDER.length : index;
}

export function sortTravelersForPricingMatch<
  T extends { passengerType: PassengerType; createdAt?: Date; id: string },
>(travelers: T[]): T[] {
  return [...travelers].sort((a, b) => {
    const typeOrder =
      passengerTypeSortIndex(a.passengerType) - passengerTypeSortIndex(b.passengerType);

    if (typeOrder !== 0) {
      return typeOrder;
    }

    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.id.localeCompare(b.id);
  });
}

export function createTravelerPricingResolver(pricingTravelers: FlightTraveler[]) {
  const indexByType = new Map<PassengerType, number>();

  return (passengerType: PassengerType): FlightTraveler | undefined => {
    const pricingForType = pricingTravelers.filter(
      (pricing) => pricing.travelerType === passengerType,
    );
    const index = indexByType.get(passengerType) ?? 0;

    if (index >= pricingForType.length) {
      return undefined;
    }

    indexByType.set(passengerType, index + 1);

    return pricingForType[index];
  };
}

export function resolveTravelerPricing(
  traveler: { passengerType: PassengerType },
  pricingTravelers: FlightTraveler[],
): FlightTraveler | undefined {
  return createTravelerPricingResolver(pricingTravelers)(traveler.passengerType);
}
