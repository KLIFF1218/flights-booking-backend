import { type SeatType, type TravelClass } from '@prisma/client';
import {
  convertCurrencyWithRates,
  getCurrencyRates,
} from 'src/modules/flights/utils/pricing/currency.util';

/** Attribute-based seat surcharge catalog is defined in USD. */
const SEAT_FEE_BASE_CURRENCY = 'USD';

const BASE_PRICE: Record<SeatType, number> = {
  WINDOW: 12,
  AISLE: 10,
  MIDDLE: 8,
};

const PREMIUM_SURCHARGE = 25;
const EXIT_ROW_SURCHARGE = 15;
const EXTRA_LEGROOM_SURCHARGE = 9;

export interface SeatPricingAttributes {
  seatType: SeatType;
  isExitRow?: boolean;
  isExtraLegroom?: boolean;
  isPremium?: boolean;
  travelClass?: TravelClass;
}

export function deriveSeatAttributesFromRow(rowNumber: number) {
  return {
    isExitRow: rowNumber === 11,
    isExtraLegroom: rowNumber === 10 || rowNumber === 11,
    isPremium: rowNumber <= 3,
  };
}

/** Returns seat surcharge in USD catalog units. */
export function computeSeatPrice(attrs: SeatPricingAttributes): number {
  let price = BASE_PRICE[attrs.seatType] ?? BASE_PRICE.MIDDLE;

  if (attrs.isPremium) {
    price += PREMIUM_SURCHARGE;
  }

  if (attrs.isExitRow) {
    price += EXIT_ROW_SURCHARGE;
  }

  if (attrs.isExtraLegroom) {
    price += EXTRA_LEGROOM_SURCHARGE;
  }

  return price;
}

/** Returns seat surcharge converted into the target currency (from USD catalog). */
export function computeSeatPriceInCurrency(
  attrs: SeatPricingAttributes,
  targetCurrency: string,
  rates: Record<string, number> = { ...getCurrencyRates() },
): number {
  return convertCurrencyWithRates(
    computeSeatPrice(attrs),
    SEAT_FEE_BASE_CURRENCY,
    targetCurrency,
    rates,
  );
}

export function resolveSeatPrice(seat: SeatPricingAttributes & { price?: unknown }): number {
  // Always derive from attributes so stored legacy magnitudes cannot break FX.
  return computeSeatPrice(seat);
}

export function resolveSeatPriceInCurrency(
  seat: SeatPricingAttributes & { price?: unknown },
  _sourceCurrency: string,
  targetCurrency: string,
  rates: Record<string, number> = { ...getCurrencyRates() },
): number {
  // Catalog is always USD; ignore stored/source currency and convert from USD.
  return computeSeatPriceInCurrency(seat, targetCurrency, rates);
}
