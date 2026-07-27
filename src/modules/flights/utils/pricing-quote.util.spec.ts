import { BadRequestException } from '@nestjs/common';
import {
  assertPriceWithinTolerance,
  assertPricingQuoteActive,
  createPricingQuoteMeta,
} from './pricing-quote.util';

describe('pricing-quote.util', () => {
  it('creates quote metadata with expiry in the future', () => {
    const quote = createPricingQuoteMeta(60);

    expect(quote.quoteId).toBeTruthy();
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects expired quotes with QUOTE_EXPIRED', () => {
    try {
      assertPricingQuoteActive({
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        errorCode?: string;
      };
      expect(response.errorCode).toBe('QUOTE_EXPIRED');
    }
  });

  it('allows totals within tolerance', () => {
    expect(() => assertPriceWithinTolerance(100, 100.005)).not.toThrow();
  });

  it('rejects totals outside tolerance with PRICE_CHANGED', () => {
    try {
      assertPriceWithinTolerance(100, 101);
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        errorCode?: string;
      };
      expect(response.errorCode).toBe('PRICE_CHANGED');
    }
  });
});
