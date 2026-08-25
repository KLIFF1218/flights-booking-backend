import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Currency, TravelClass } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { DbPricingProvider } from './db-pricing-provider.service';
import { FlightsSearchStore } from './flights-cache.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CalculateSeatPrice } from './calculate-seatprice.service';
import { CurrencyRatesService } from './currency-rates.service';
import { BookingSnapshotOfferService } from './booking-snapshot-offer.service';
import { buildCachedPricingOffer, buildMockFlightInstance } from '../flights-test.fixtures';

describe('DbPricingProvider', () => {
  let service: DbPricingProvider;
  let module: TestingModule;

  const searchStore = {
    getOfferWithContext: jest.fn(),
    getLastPricing: jest.fn(),
    replaceOfferInSearch: jest.fn(),
    saveLastPricing: jest.fn(),
  };
  const calculateSeatPrice = {
    calculateSeatPrice: jest.fn(),
  };
  const currencyRatesService = {
    syncRatesFromRedis: jest.fn().mockResolvedValue({ USD: 1, EUR: 0.92, RUB: 90 }),
  };
  const prisma = {
    flightInstance: { findMany: jest.fn() },
  };
  const bookingSnapshotOffer = {
    resolveOfferContext: jest.fn(),
  };

  const instance = buildMockFlightInstance({
    id: 'fi-jfk-sfo',
    departureDate: new Date('2026-08-15T14:00:00.000Z'),
    origin: 'JFK',
    destination: 'SFO',
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        DbPricingProvider,
        { provide: FlightsSearchStore, useValue: searchStore },
        { provide: PrismaService, useValue: prisma },
        { provide: CalculateSeatPrice, useValue: calculateSeatPrice },
        { provide: CurrencyRatesService, useValue: currencyRatesService },
        { provide: BookingSnapshotOfferService, useValue: bookingSnapshotOffer },
        { provide: Logger, useValue: { debug: jest.fn() } },
      ],
    }).compile();

    service = module.get(DbPricingProvider);
    prisma.flightInstance.findMany.mockResolvedValue([instance]);
    calculateSeatPrice.calculateSeatPrice.mockResolvedValue(0);
    searchStore.replaceOfferInSearch.mockResolvedValue(undefined);
    searchStore.saveLastPricing.mockResolvedValue(undefined);
    searchStore.getLastPricing.mockResolvedValue(null);
  });

  afterEach(async () => {
    await module.close();
  });

  it('throws when cached offer is missing', async () => {
    bookingSnapshotOffer.resolveOfferContext.mockResolvedValue(null);

    await expect(service.price('search-1', 'offer-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prices offer from cached search context', async () => {
    const offer = buildCachedPricingOffer('fi-jfk-sfo');
    bookingSnapshotOffer.resolveOfferContext.mockResolvedValue({
      offer,
      searchContext: {
        passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 },
        travelClass: TravelClass.ECONOMY,
        currencyCode: Currency.USD,
      },
      offerCurrency: Currency.USD,
      pricingHint: null,
    });

    const result = await service.price('search-1', 'fi-jfk-sfo');

    expect(result.id).toBe('fi-jfk-sfo');
    expect(result.quoteId).toBeTruthy();
    expect(result.price.currency).toBe(Currency.USD);
    expect(result.price.total).toBeGreaterThan(0);
    expect(searchStore.replaceOfferInSearch).toHaveBeenCalled();
    expect(searchStore.saveLastPricing).toHaveBeenCalled();
    expect(calculateSeatPrice.calculateSeatPrice).toHaveBeenCalledWith(
      expect.any(Object),
      [],
      Currency.USD,
      Currency.USD,
      expect.objectContaining({ USD: 1 }),
      undefined,
    );
  });

  it('includes seat surcharge and bookingId when seats are selected', async () => {
    const offer = buildCachedPricingOffer('fi-jfk-sfo');
    bookingSnapshotOffer.resolveOfferContext.mockResolvedValue({
      offer,
      searchContext: {
        passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 },
        travelClass: TravelClass.ECONOMY,
      },
      offerCurrency: Currency.USD,
      pricingHint: null,
    });
    calculateSeatPrice.calculateSeatPrice.mockResolvedValue(40);

    const result = await service.price('search-1', 'fi-jfk-sfo', {
      seats: [{ segmentId: 'seg-fi-jfk-sfo', seatNumber: '12A' }],
      bookingId: 'booking-1',
    });

    expect(result.price.seats).toBe(40);
    expect(calculateSeatPrice.calculateSeatPrice).toHaveBeenCalledWith(
      expect.any(Object),
      [{ segmentId: 'seg-fi-jfk-sfo', seatNumber: '12A' }],
      Currency.USD,
      Currency.USD,
      expect.any(Object),
      'booking-1',
    );
  });

  it('converts offer to requested currency when currencyCode differs from cached offer', async () => {
    const offer = buildCachedPricingOffer('fi-jfk-sfo');
    bookingSnapshotOffer.resolveOfferContext.mockResolvedValue({
      offer,
      searchContext: {
        passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 },
        travelClass: TravelClass.ECONOMY,
        currencyCode: Currency.USD,
      },
      offerCurrency: Currency.USD,
      pricingHint: null,
    });

    const result = await service.price('search-1', 'fi-jfk-sfo', { currencyCode: Currency.RUB });

    expect(result.price.currency).toBe(Currency.RUB);
    expect(searchStore.replaceOfferInSearch).toHaveBeenCalledWith(
      'search-1',
      'fi-jfk-sfo',
      expect.objectContaining({
        currencyCode: Currency.RUB,
        price: expect.objectContaining({ currency: Currency.RUB }),
      }),
    );
    expect(calculateSeatPrice.calculateSeatPrice).toHaveBeenCalledWith(
      expect.any(Object),
      [],
      Currency.USD,
      Currency.RUB,
      expect.objectContaining({ USD: 1, RUB: 90 }),
      undefined,
    );
  });
});
