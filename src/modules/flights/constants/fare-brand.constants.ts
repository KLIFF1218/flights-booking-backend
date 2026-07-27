import { FareBrand, TravelClass } from '@prisma/client';

/** Search/pricing default when the client does not pick a fare family. */
export const DEFAULT_SEARCH_FARE_BRAND = FareBrand.LIGHT;

/** Offer inventory source — this project prices only from its own DB. */
export const OFFER_SOURCE_INTERNAL_DB = 'INTERNAL_DB' as const;

/** Quotes are simulator prices, not airline/ATPCO tickets. */
export const PRICING_MODE_INDICATIVE = 'indicative' as const;

export type FareBrandRules = {
  priceMultiplier: number;
  changeable: boolean;
  refundable: boolean;
  checkedBags: number;
};

export function resolveFareBrandRules(
  fareBrand: FareBrand,
  travelClass: TravelClass,
): FareBrandRules {
  if (fareBrand === FareBrand.FLEX) {
    return {
      priceMultiplier: 1.35,
      changeable: true,
      refundable: true,
      checkedBags: travelClass === TravelClass.ECONOMY ? 1 : 2,
    };
  }

  return {
    priceMultiplier: 1,
    changeable: false,
    refundable: false,
    checkedBags: travelClass === TravelClass.ECONOMY ? 0 : 1,
  };
}

export function isFareBrand(value: unknown): value is FareBrand {
  return value === FareBrand.LIGHT || value === FareBrand.FLEX;
}
