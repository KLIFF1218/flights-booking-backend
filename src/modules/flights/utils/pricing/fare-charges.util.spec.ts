import {
  BOOKING_SERVICE_FEE,
  buildFarePriceBreakdown,
  FARE_TAX_YQ_RATE,
  FARE_TAX_YR_RATE,
  mergeLegOfferPrices,
  mergeOfferPrices,
  resetFareChargesConfig,
} from './fare-charges.util';

describe('fare-charges.util', () => {
  afterEach(() => {
    resetFareChargesConfig();
  });

  it('adds tax and fee line items on top of base fare', () => {
    const breakdown = buildFarePriceBreakdown(100, 2);

    expect(breakdown.base).toBe(100);
    expect(breakdown.taxes).toEqual(
      expect.arrayContaining([
        { code: 'YQ', amount: (100 * FARE_TAX_YQ_RATE).toFixed(2) },
        { code: 'YR', amount: (100 * FARE_TAX_YR_RATE).toFixed(2) },
      ]),
    );
    expect(breakdown.fees).toEqual([
      { type: 'SERVICE_FEE', amount: (BOOKING_SERVICE_FEE * 2).toFixed(2) },
    ]);
    expect(breakdown.total).toBe(breakdown.base + breakdown.taxTotal + breakdown.feeTotal);
  });

  it('merges offer prices while preserving tax and fee breakdown', () => {
    const outbound = buildFarePriceBreakdown(100, 1);
    const inbound = buildFarePriceBreakdown(80, 1);

    const merged = mergeOfferPrices(
      {
        currency: 'USD',
        base: outbound.base.toFixed(2),
        total: outbound.total.toFixed(2),
        grandTotal: outbound.total.toFixed(2),
        taxes: outbound.taxes,
        fees: outbound.fees,
      },
      {
        currency: 'USD',
        base: inbound.base.toFixed(2),
        total: inbound.total.toFixed(2),
        grandTotal: inbound.total.toFixed(2),
        taxes: inbound.taxes,
        fees: inbound.fees,
      },
    );

    expect(Number(merged.base)).toBe(180);
    expect(Number(merged.total)).toBeGreaterThan(180);
    expect(merged.taxes?.length).toBeGreaterThan(0);
    expect(merged.fees?.length).toBeGreaterThan(0);
  });

  it('merges leg prices with a single booking-level service fee', () => {
    const outbound = buildFarePriceBreakdown(100, 2);
    const inbound = buildFarePriceBreakdown(80, 2);

    const merged = mergeLegOfferPrices(
      {
        currency: 'USD',
        base: outbound.base.toFixed(2),
        total: outbound.total.toFixed(2),
        grandTotal: outbound.total.toFixed(2),
        taxes: outbound.taxes,
        fees: outbound.fees,
      },
      {
        currency: 'USD',
        base: inbound.base.toFixed(2),
        total: inbound.total.toFixed(2),
        grandTotal: inbound.total.toFixed(2),
        taxes: inbound.taxes,
        fees: inbound.fees,
      },
      2,
    );

    expect(Number(merged.base)).toBe(180);
    expect(merged.fees).toEqual([
      { type: 'SERVICE_FEE', amount: (BOOKING_SERVICE_FEE * 2).toFixed(2) },
    ]);
  });
});
