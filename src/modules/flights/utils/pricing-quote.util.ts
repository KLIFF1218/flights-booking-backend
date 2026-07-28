import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const PRICING_QUOTE_TTL_SECONDS = 15 * 60;
export const PRICING_QUOTE_WITH_SEATS_TTL_SECONDS = 5 * 60;

export type PricingRepriceReason = 'QUOTE_EXPIRED' | 'PRICE_CHANGED' | 'QUOTE_MISMATCH';

export interface PricingQuoteMeta {
  quoteId: string;
  quotedAt: string;
  expiresAt: string;
}

export function createPricingQuoteMeta(ttlSeconds = PRICING_QUOTE_TTL_SECONDS): PricingQuoteMeta {
  const quotedAt = new Date();

  return {
    quoteId: randomUUID(),
    quotedAt: quotedAt.toISOString(),
    expiresAt: new Date(quotedAt.getTime() + ttlSeconds * 1000).toISOString(),
  };
}

function throwPricingRepriceError(message: string, reason: PricingRepriceReason): void {
  throw new BadRequestException({
    message,
    errorCode: reason,
    repriceReason: reason,
  });
}

export function assertPricingQuoteActive(quote: { expiresAt?: string }): void {
  if (quote.expiresAt && new Date(quote.expiresAt) < new Date()) {
    throwPricingRepriceError('Pricing quote expired. Please refresh the price.', 'QUOTE_EXPIRED');
  }
}

export function assertPriceWithinTolerance(
  expectedTotal: number,
  actualTotal: number,
  tolerance = 0.01,
): void {
  if (Math.abs(expectedTotal - actualTotal) > tolerance) {
    throwPricingRepriceError('Price has changed. Please refresh the quote.', 'PRICE_CHANGED');
  }
}

export function assertPricingQuoteIdMatches(
  activeQuote: { quoteId: string } | null | undefined,
  pricingQuoteId: string,
): void {
  if (!activeQuote || activeQuote.quoteId !== pricingQuoteId) {
    throwPricingRepriceError(
      'Pricing quote is outdated. Please refresh the price.',
      'QUOTE_MISMATCH',
    );
  }
}
