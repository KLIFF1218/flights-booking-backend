import { Currency, FareBrand, PassengerType, TravelClass } from '@prisma/client';
import {
  airlineSupportsFirstClass,
  buildFlightFaresFromAdultPrices,
  getRequiredTravelClasses,
} from './flight-fare-builder.util';

describe('flight-fare-builder.util', () => {
  it('marks BA/LH/EK as First-class airlines', () => {
    expect(airlineSupportsFirstClass('BA')).toBe(true);
    expect(airlineSupportsFirstClass('su')).toBe(false);
  });

  it('requires First only for First-class airlines', () => {
    expect(getRequiredTravelClasses('SU')).toEqual([
      TravelClass.ECONOMY,
      TravelClass.PREMIUM_ECONOMY,
      TravelClass.BUSINESS,
    ]);
    expect(getRequiredTravelClasses('LH')).toContain(TravelClass.FIRST);
  });

  it('builds LIGHT and FLEX passenger fares from explicit adult prices', () => {
    const rows = buildFlightFaresFromAdultPrices({
      instanceId: 'inst-1',
      currency: Currency.RUB,
      airlineCode: 'SU',
      adultPrices: {
        economy: 10000,
        premiumEconomy: 16000,
        business: 28000,
      },
    });

    // 3 classes × 2 brands × 4 passenger types
    expect(rows).toHaveLength(24);

    const economyAdultLight = rows.find(
      (row) =>
        row.travelClass === TravelClass.ECONOMY &&
        row.passengerType === PassengerType.ADULT &&
        row.fareBrand === FareBrand.LIGHT,
    );
    const economyAdultFlex = rows.find(
      (row) =>
        row.travelClass === TravelClass.ECONOMY &&
        row.passengerType === PassengerType.ADULT &&
        row.fareBrand === FareBrand.FLEX,
    );
    const economyChildLight = rows.find(
      (row) =>
        row.travelClass === TravelClass.ECONOMY &&
        row.passengerType === PassengerType.CHILD &&
        row.fareBrand === FareBrand.LIGHT,
    );

    expect(economyAdultLight?.basePrice).toBe(10000);
    expect(economyAdultLight?.checkedBags).toBe(0);
    expect(economyAdultLight?.changeable).toBe(false);
    expect(economyAdultLight?.refundable).toBe(false);

    expect(economyAdultFlex?.basePrice).toBe(13500);
    expect(economyAdultFlex?.checkedBags).toBe(1);
    expect(economyAdultFlex?.changeable).toBe(true);
    expect(economyAdultFlex?.refundable).toBe(true);

    expect(economyChildLight?.basePrice).toBe(7500);
    expect(rows.every((row) => row.currency === Currency.RUB)).toBe(true);
    expect(rows.some((row) => row.travelClass === TravelClass.FIRST)).toBe(false);
  });

  it('includes First when airline sells it and price is provided', () => {
    const rows = buildFlightFaresFromAdultPrices({
      instanceId: 'inst-2',
      currency: Currency.USD,
      airlineCode: 'BA',
      adultPrices: {
        economy: 100,
        premiumEconomy: 160,
        business: 280,
        first: 450,
      },
    });

    // 4 classes × 2 brands × 4 passenger types
    expect(rows).toHaveLength(32);
    expect(
      rows.some(
        (row) =>
          row.travelClass === TravelClass.FIRST &&
          row.passengerType === PassengerType.ADULT &&
          row.fareBrand === FareBrand.LIGHT &&
          row.basePrice === 450,
      ),
    ).toBe(true);
  });

  it('throws when First is required but missing', () => {
    expect(() =>
      buildFlightFaresFromAdultPrices({
        instanceId: 'inst-3',
        currency: Currency.USD,
        airlineCode: 'EK',
        adultPrices: {
          economy: 100,
          premiumEconomy: 160,
          business: 280,
        },
      }),
    ).toThrow(/FIRST/);
  });
});
