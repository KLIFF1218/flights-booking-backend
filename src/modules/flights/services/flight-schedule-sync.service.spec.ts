import { Test, type TestingModule } from '@nestjs/testing';
import { FlightStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { FlightScheduleSyncService } from './flight-schedule-sync.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightsSearchStore } from './flights-cache.service';
import { buildCachedPricingOffer, buildMockFlightInstance } from '../tests/flights-test.fixtures';

describe('FlightScheduleSyncService', () => {
  let service: FlightScheduleSyncService;
  let module: TestingModule;

  const searchStore = {
    invalidateAllSearchCaches: jest.fn(),
    mutateCachedOffers: jest.fn(),
    invalidateOfferPricing: jest.fn(),
  };
  const prisma = {
    flightInstance: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        FlightScheduleSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: FlightsSearchStore, useValue: searchStore },
        { provide: Logger, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(FlightScheduleSyncService);
    searchStore.invalidateOfferPricing.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await module.close();
  });

  it('invalidates all search caches when a new instance is created', async () => {
    searchStore.invalidateAllSearchCaches.mockResolvedValue(3);

    await service.onFlightInstanceCreated('fi-new');

    expect(searchStore.invalidateAllSearchCaches).toHaveBeenCalled();
  });

  it('drops cancelled offers from cached searches', async () => {
    const offer = buildCachedPricingOffer('fi-jfk-sfo');
    const instance = {
      ...buildMockFlightInstance({
        id: 'fi-jfk-sfo',
        departureDate: new Date('2026-08-15T14:00:00.000Z'),
        origin: 'JFK',
        destination: 'SFO',
      }),
      status: FlightStatus.CANCELLED,
    };

    prisma.flightInstance.findUnique.mockResolvedValue(instance);
    searchStore.mutateCachedOffers.mockImplementation(async (mutator) => {
      const updated = await mutator('search-1', {
        offers: [offer],
        expiresAt: '2026-12-31T00:00:00.000Z',
        queryHash: 'hash',
      });
      expect(updated?.offers).toEqual([]);
    });

    await service.onFlightInstanceUpdated('fi-jfk-sfo');

    expect(searchStore.invalidateOfferPricing).toHaveBeenCalledWith('search-1', 'fi-jfk-sfo');
  });

  it('refreshes offers from database and drops unbookable inventory', async () => {
    const offer = buildCachedPricingOffer('fi-jfk-sfo');
    prisma.flightInstance.findMany.mockResolvedValue([
      {
        ...buildMockFlightInstance({
          id: 'fi-jfk-sfo',
          departureDate: new Date('2026-08-15T14:00:00.000Z'),
          origin: 'JFK',
          destination: 'SFO',
        }),
        seatsAvailable: 0,
      },
    ]);

    const refreshed = await service.refreshOffersFromDatabase([offer], {
      passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 },
    });

    expect(refreshed).toEqual([]);
  });
});
