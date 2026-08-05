import type { Currency } from '@prisma/client';

export interface TaxLineItem {
  amount: string;
  code: string;
}

export interface FeeLineItem {
  amount: string;
  type: string;
}

export interface FarePriceBreakdown {
  base: number;
  taxes: TaxLineItem[];
  fees: FeeLineItem[];
  taxTotal: number;
  feeTotal: number;
  total: number;
}

export type FareChargesConfig = {
  taxYqRate: number;
  taxYrRate: number;
  bookingServiceFee: number;
};

const DEFAULT_FARE_CHARGES: FareChargesConfig = {
  taxYqRate: 0.08,
  taxYrRate: 0.05,
  bookingServiceFee: 5,
};

let fareChargesConfig: FareChargesConfig = { ...DEFAULT_FARE_CHARGES };

/** Called from FlightsModule bootstrap with ConfigService values. */
export function configureFareCharges(partial: Partial<FareChargesConfig>): void {
  fareChargesConfig = {
    ...fareChargesConfig,
    ...partial,
  };
  // Keep exported lets in sync for existing specs/imports.
  FARE_TAX_YQ_RATE = fareChargesConfig.taxYqRate;
  FARE_TAX_YR_RATE = fareChargesConfig.taxYrRate;
  BOOKING_SERVICE_FEE = fareChargesConfig.bookingServiceFee;
}

export function getFareChargesConfig(): FareChargesConfig {
  return fareChargesConfig;
}

export function resetFareChargesConfig(): void {
  fareChargesConfig = { ...DEFAULT_FARE_CHARGES };
  FARE_TAX_YQ_RATE = DEFAULT_FARE_CHARGES.taxYqRate;
  FARE_TAX_YR_RATE = DEFAULT_FARE_CHARGES.taxYrRate;
  BOOKING_SERVICE_FEE = DEFAULT_FARE_CHARGES.bookingServiceFee;
}

/** Mutable mirrors of config (updated via configureFareCharges). */
export let FARE_TAX_YQ_RATE = DEFAULT_FARE_CHARGES.taxYqRate;
export let FARE_TAX_YR_RATE = DEFAULT_FARE_CHARGES.taxYrRate;
export let BOOKING_SERVICE_FEE = DEFAULT_FARE_CHARGES.bookingServiceFee;

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number): string {
  return roundMoney(amount).toFixed(2);
}

export function sumLineItems(items: Array<{ amount: string }>): number {
  return roundMoney(items.reduce((sum, item) => sum + Number(item.amount), 0));
}

export function mergeTaxLineItems(
  left: TaxLineItem[] | undefined,
  right: TaxLineItem[] | undefined,
): TaxLineItem[] {
  const totals = new Map<string, number>();

  for (const item of [...(left ?? []), ...(right ?? [])]) {
    totals.set(item.code, roundMoney((totals.get(item.code) ?? 0) + Number(item.amount)));
  }

  return Array.from(totals.entries()).map(([code, amount]) => ({
    code,
    amount: formatMoney(amount),
  }));
}

export function mergeFeeLineItems(
  left: FeeLineItem[] | undefined,
  right: FeeLineItem[] | undefined,
): FeeLineItem[] {
  const totals = new Map<string, number>();

  for (const item of [...(left ?? []), ...(right ?? [])]) {
    totals.set(item.type, roundMoney((totals.get(item.type) ?? 0) + Number(item.amount)));
  }

  return Array.from(totals.entries()).map(([type, amount]) => ({
    type,
    amount: formatMoney(amount),
  }));
}

export function buildFarePriceBreakdown(
  baseAmount: number,
  feePassengerCount: number,
): FarePriceBreakdown {
  const { taxYqRate, taxYrRate, bookingServiceFee } = fareChargesConfig;
  const base = roundMoney(baseAmount);
  const taxes: TaxLineItem[] = [];

  if (taxYqRate > 0) {
    taxes.push({
      code: 'YQ',
      amount: formatMoney(base * taxYqRate),
    });
  }

  if (taxYrRate > 0) {
    taxes.push({
      code: 'YR',
      amount: formatMoney(base * taxYrRate),
    });
  }

  const fees: FeeLineItem[] = [];
  if (bookingServiceFee > 0 && feePassengerCount > 0) {
    fees.push({
      type: 'SERVICE_FEE',
      amount: formatMoney(bookingServiceFee * feePassengerCount),
    });
  }

  const taxTotal = sumLineItems(taxes);
  const feeTotal = sumLineItems(fees);

  return {
    base,
    taxes,
    fees,
    taxTotal,
    feeTotal,
    total: roundMoney(base + taxTotal + feeTotal),
  };
}

export interface OfferPriceFields {
  currency: Currency;
  base: string;
  total: string;
  grandTotal: string;
  taxes?: TaxLineItem[];
  fees?: FeeLineItem[];
}

export function formatOfferPrice(
  currency: Currency,
  breakdown: FarePriceBreakdown,
): OfferPriceFields {
  return {
    currency,
    base: formatMoney(breakdown.base),
    total: formatMoney(breakdown.total),
    grandTotal: formatMoney(breakdown.total),
    taxes: breakdown.taxes,
    fees: breakdown.fees,
  };
}

export function mergeOfferPrices(
  left: OfferPriceFields,
  right: OfferPriceFields,
): OfferPriceFields {
  const base = roundMoney(Number(left.base) + Number(right.base));
  const taxes = mergeTaxLineItems(left.taxes, right.taxes);
  const fees = mergeFeeLineItems(left.fees, right.fees);
  const taxTotal = sumLineItems(taxes);
  const feeTotal = sumLineItems(fees);
  const total = roundMoney(base + taxTotal + feeTotal);

  return {
    currency: left.currency,
    base: formatMoney(base),
    total: formatMoney(total),
    grandTotal: formatMoney(total),
    taxes,
    fees,
  };
}

/** Merges leg prices with a single booking-level service fee (matches pricing engine). */
export function mergeLegOfferPrices(
  left: OfferPriceFields,
  right: OfferPriceFields,
  seatsRequired: number,
): OfferPriceFields {
  const combinedBase = roundMoney(Number(left.base) + Number(right.base));
  const breakdown = buildFarePriceBreakdown(combinedBase, seatsRequired);

  return formatOfferPrice(left.currency, breakdown);
}
