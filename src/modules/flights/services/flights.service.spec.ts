import { ServiceUnavailableException } from '@nestjs/common';
import { FlightsService } from './flights.service';
import type { SearchFlightsDto } from '../dtos';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { PreprocessedFlightOffer } from '../types/flights.types';
import type { FlightSearchProvider } from '../providers/flight-search.provider';
import type { FlightsSearchStore } from './flights-cache.service';
import type { FlightOfferMapper } from './flight-offer.mapper';
import type { MetricsService } from 'src/infra/metrics/metrics.service';
import type { FlightScheduleSyncService } from './flight-schedule-sync.service';
import { preprocessOffers } from '../utils/search/preprocess-offers.util';
import { isoDateDaysFromNow } from '../flights-test.fixtures';

const futureDateFrom = isoDateDaysFromNow(30);

function makeOffer(id: string, total = '100.00'): FlightOffer {
  return {
    id,
    numberOfBookableSeats: 9,
    price: {
      total,
      currency: 'USD',
      base: total,
      grandTotal: total,
    },
    itineraries: [
      {
        duration: 'PT2H',
        segments: [
          {
            id: 'seg-1',
            departure: { iataCode: 'HEL', at: `${futureDateFrom}T10:00:00.000Z` },
            arrival: { iataCode: 'JFK', at: `${futureDateFrom}T12:00:00.000Z` },
            carrierCode: 'AY',
            number: '15',
            duration: 'PT2H',
          },
        ],
      },
    ],
  } as FlightOffer;
}

function makeCachedOffer(id: string, total = '100.00'): PreprocessedFlightOffer {
  return preprocessOffers([makeOffer(id, total)])[0];
}

describe('FlightsService', () => {
  const searchDto: SearchFlightsDto = {
    directions: [{ origin: 'HEL', destination: 'JFK', dateFrom: futureDateFrom }],
    passengers: { adults: 1 },
    travelClass: 'ECONOMY' as SearchFlightsDto['travelClass'],
    currencyCode: 'USD' as SearchFlightsDto['currencyCode'],
  };

  const provider: jest.Mocked<Pick<FlightSearchProvider, 'searchFlights'>> = {
    searchFlights: jest.fn(),
  };

  const searchStore = {
    getSearchIdByQuery: jest.fn(),
    getSearchResults: jest.fn(),
    deleteSearchIdByQuery: jest.fn(),
    acquireSearchLock: jest.fn(),
    releaseSearchLock: jest.fn(),
    waitForSearchIdByQuery: jest.fn(),
    saveSearchResults: jest.fn(),
    saveSearchIdByQueryIfAbsent: jest.fn(),
    deleteSearchResults: jest.fn(),
  };

  const offerMapper = {
    toCard: jest.fn((offer: { id: string }) => ({ offerId: offer.id })),
  };

  const metrics = {
    flightSearchDuration: {
      startTimer: jest.fn(() => jest.fn()),
    },
    recordFlightSearch: jest.fn(),
    recordRedisCache: jest.fn(),
    recordRedisLock: jest.fn(),
  };

  const scheduleSync = {
    refreshOffersFromDatabase: jest.fn(async (offers: unknown[]) => offers),
  };

  let service: FlightsService;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduleSync.refreshOffersFromDatabase.mockImplementation(async (offers: unknown[]) => offers);
    offerMapper.toCard.mockImplementation((offer: { id: string }) => ({ offerId: offer.id }));
    metrics.flightSearchDuration.startTimer.mockReturnValue(jest.fn());

    service = new FlightsService(
      provider as unknown as FlightSearchProvider,
      searchStore as unknown as FlightsSearchStore,
      offerMapper as unknown as FlightOfferMapper,
      metrics as unknown as MetricsService,
      scheduleSync as unknown as FlightScheduleSyncService,
    );
  });

  it('returns cached search without calling provider (cache hit)', async () => {
    const offer = makeCachedOffer('offer-cached');
    searchStore.getSearchIdByQuery.mockResolvedValue('search-cached');
    searchStore.getSearchResults.mockResolvedValue({
      offers: [offer],
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
      queryHash: 'ignored',
      context: { passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 } },
    });

    const result = await service.createSearch(searchDto);

    expect(provider.searchFlights).not.toHaveBeenCalled();
    expect(searchStore.acquireSearchLock).not.toHaveBeenCalled();
    expect(result.searchId).toBe('search-cached');
    expect(result.data).toEqual([{ offerId: 'offer-cached' }]);
    expect(metrics.recordRedisCache).toHaveBeenCalledWith('flight_search', 'hit');
    expect(metrics.recordFlightSearch).toHaveBeenCalledWith('HEL', 'JFK', 'cache');
  });

  it('acquires lock, searches provider, and persists results', async () => {
    const offer = makeOffer('offer-fresh');
    searchStore.getSearchIdByQuery.mockResolvedValue(null);
    searchStore.acquireSearchLock.mockResolvedValue(true);
    searchStore.saveSearchResults.mockResolvedValue({
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
    });
    searchStore.saveSearchIdByQueryIfAbsent.mockResolvedValue(true);
    provider.searchFlights.mockResolvedValue({ meta: { count: 1 }, data: [offer] });

    const result = await service.createSearch(searchDto);

    expect(provider.searchFlights).toHaveBeenCalledTimes(1);
    expect(searchStore.saveSearchResults).toHaveBeenCalled();
    expect(searchStore.saveSearchIdByQueryIfAbsent).toHaveBeenCalled();
    expect(searchStore.releaseSearchLock).toHaveBeenCalled();
    expect(result.data).toEqual([{ offerId: 'offer-fresh' }]);
    expect(result.meta).toMatchObject({ total: 1, limit: 20, hasNextPage: false });
    expect(metrics.recordRedisLock).toHaveBeenCalledWith('flight_search', 'acquired');
    expect(metrics.recordFlightSearch).toHaveBeenCalledWith('HEL', 'JFK', 'success');
  });

  it('waits for peer search when lock is busy, then returns peer cache', async () => {
    const offer = makeCachedOffer('offer-peer');
    searchStore.getSearchIdByQuery
      .mockResolvedValueOnce(null) // initial miss
      .mockResolvedValue('search-peer'); // after wait / getCachedSearch
    searchStore.acquireSearchLock.mockResolvedValue(false);
    searchStore.waitForSearchIdByQuery.mockResolvedValue('search-peer');
    searchStore.getSearchResults.mockResolvedValue({
      offers: [offer],
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
      queryHash: 'q',
      context: { passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 } },
    });

    const result = await service.createSearch(searchDto);

    expect(provider.searchFlights).not.toHaveBeenCalled();
    expect(searchStore.waitForSearchIdByQuery).toHaveBeenCalled();
    expect(result.searchId).toBe('search-peer');
    expect(metrics.recordRedisLock).toHaveBeenCalledWith('flight_search', 'busy');
    expect(metrics.recordFlightSearch).toHaveBeenCalledWith('HEL', 'JFK', 'cache');
  });

  it('throws 503 when lock stays busy and peer never publishes', async () => {
    searchStore.getSearchIdByQuery.mockResolvedValue(null);
    searchStore.acquireSearchLock.mockResolvedValue(false);
    searchStore.waitForSearchIdByQuery.mockResolvedValue(null);

    await expect(service.createSearch(searchDto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(provider.searchFlights).not.toHaveBeenCalled();
    expect(searchStore.acquireSearchLock).toHaveBeenCalledTimes(2);
    expect(metrics.recordFlightSearch).toHaveBeenCalledWith('HEL', 'JFK', 'failure');
  });

  it('uses winning query mapping when saveSearchIdByQueryIfAbsent loses the race', async () => {
    const orphanOffer = makeOffer('offer-orphan');
    const winnerOffer = makeCachedOffer('offer-winner');

    searchStore.getSearchIdByQuery
      .mockResolvedValueOnce(null) // cache miss before lock
      .mockResolvedValueOnce(null) // cachedAfterLock
      .mockResolvedValueOnce('search-winner'); // after lost mapping race
    searchStore.acquireSearchLock.mockResolvedValue(true);
    searchStore.saveSearchResults.mockResolvedValue({
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
    });
    searchStore.saveSearchIdByQueryIfAbsent.mockResolvedValue(false);
    searchStore.getSearchResults.mockResolvedValue({
      offers: [winnerOffer],
      expiresAt: `${futureDateFrom}T13:00:00.000Z`,
      queryHash: 'q',
    });
    provider.searchFlights.mockResolvedValue({ meta: { count: 1 }, data: [orphanOffer] });

    const result = await service.createSearch(searchDto);

    expect(searchStore.deleteSearchResults).toHaveBeenCalled();
    expect(result.searchId).toBe('search-winner');
    expect(result.data).toEqual([{ offerId: 'offer-winner' }]);
    expect(result.expiresAt).toBe(`${futureDateFrom}T13:00:00.000Z`);
    expect(searchStore.releaseSearchLock).toHaveBeenCalled();
  });

  it('re-checks cache after acquiring lock (double-checked locking)', async () => {
    const offer = makeCachedOffer('offer-after-lock');
    searchStore.getSearchIdByQuery
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('search-after-lock');
    searchStore.acquireSearchLock.mockResolvedValue(true);
    searchStore.getSearchResults.mockResolvedValue({
      offers: [offer],
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
      queryHash: 'q',
    });

    const result = await service.createSearch(searchDto);

    expect(provider.searchFlights).not.toHaveBeenCalled();
    expect(result.searchId).toBe('search-after-lock');
    expect(searchStore.releaseSearchLock).toHaveBeenCalled();
  });

  it('returns paginated search page with filters and sort', async () => {
    const offerA = makeCachedOffer('offer-a', '80.00');
    const offerB = makeCachedOffer('offer-b', '120.00');
    offerA._sort = { price: 80, duration: 120, bestScore: 1 };
    offerB._sort = { price: 120, duration: 180, bestScore: 2 };

    searchStore.getSearchResults.mockResolvedValue({
      offers: [offerB, offerA],
      expiresAt: `${futureDateFrom}T12:00:00.000Z`,
      queryHash: 'hash-1',
      context: { passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 } },
    });
    scheduleSync.refreshOffersFromDatabase.mockImplementation(async (offers) => offers);

    const result = await service.getSearchPage('search-1', { limit: 1, sort: 'CHEAPEST' });

    expect(result.searchId).toBe('search-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].offerId).toBe('offer-a');
    expect(result.meta.total).toBe(2);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.links.next).toContain('search/search-1');
  });

  it('throws when search page is missing from cache', async () => {
    searchStore.getSearchResults.mockResolvedValue(null);

    await expect(service.getSearchPage('missing')).rejects.toThrow('Search expired or not found');
  });
});
