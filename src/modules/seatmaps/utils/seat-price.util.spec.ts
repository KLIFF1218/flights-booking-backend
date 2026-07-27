import { SeatType } from '@prisma/client';
import {
  convertCurrency,
  convertCurrencyWithRates,
  setCurrencyRates,
} from 'src/modules/flights/utils/currency.util';
import {
  computeSeatPrice,
  computeSeatPriceInCurrency,
  deriveSeatAttributesFromRow,
  resolveSeatPrice,
  resolveSeatPriceInCurrency,
} from './seat-price.util';

describe('seat-price.util', () => {
  beforeEach(() => {
    setCurrencyRates({ USD: 1, EUR: 0.92, RUB: 90 });
  });

  it('prices seats in USD-scale amounts before FX conversion', () => {
    expect(
      computeSeatPrice({
        seatType: SeatType.MIDDLE,
        isPremium: false,
        isExitRow: false,
        isExtraLegroom: false,
      }),
    ).toBe(8);
  });

  it('converts seat surcharges to the search currency from USD catalog', () => {
    const rubPrice = resolveSeatPriceInCurrency(
      {
        price: 4100,
        seatType: SeatType.WINDOW,
        isPremium: true,
        isExitRow: true,
        isExtraLegroom: true,
      },
      'RUB',
      'RUB',
    );

    expect(rubPrice).toBe(convertCurrency(61, 'USD', 'RUB'));
    expect(rubPrice).toBeLessThan(10_000);
  });

  it('stores seat fees converted into fare currency', () => {
    const rubStored = computeSeatPriceInCurrency(
      {
        seatType: SeatType.MIDDLE,
        isPremium: false,
        isExitRow: false,
        isExtraLegroom: false,
      },
      'RUB',
    );

    expect(rubStored).toBe(convertCurrency(8, 'USD', 'RUB'));
  });

  it('uses quote-locked FX rates instead of the global table', () => {
    setCurrencyRates({ USD: 1, EUR: 0.92, RUB: 100 });
    const lockedRates = { USD: 1, EUR: 0.92, RUB: 90 };

    const withLocked = resolveSeatPriceInCurrency(
      {
        seatType: SeatType.MIDDLE,
        isPremium: false,
        isExitRow: false,
        isExtraLegroom: false,
      },
      'USD',
      'RUB',
      lockedRates,
    );

    expect(withLocked).toBe(convertCurrencyWithRates(8, 'USD', 'RUB', lockedRates));
    expect(withLocked).not.toBe(convertCurrency(8, 'USD', 'RUB'));
  });

  it('deriveSeatAttributesFromRow maps row numbers to seat attributes', () => {
    expect(deriveSeatAttributesFromRow(3)).toEqual({
      isExitRow: false,
      isExtraLegroom: false,
      isPremium: true,
    });
    expect(deriveSeatAttributesFromRow(10)).toEqual({
      isExitRow: false,
      isExtraLegroom: true,
      isPremium: false,
    });
    expect(deriveSeatAttributesFromRow(11)).toEqual({
      isExitRow: true,
      isExtraLegroom: true,
      isPremium: false,
    });
  });

  it('resolveSeatPrice ignores stored legacy seat price magnitudes', () => {
    expect(
      resolveSeatPrice({
        price: 999_999,
        seatType: SeatType.MIDDLE,
        isPremium: false,
        isExitRow: false,
        isExtraLegroom: false,
      }),
    ).toBe(8);
  });
});
