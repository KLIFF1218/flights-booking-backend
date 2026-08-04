import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { SearchFlightsDto } from '../dtos';
import type { FlightsQueryDto } from '../dtos/flights-query.dto';

import { EMPTY_SEARCH_TTL_SECONDS, FlightsSearchStore } from '../services/flights-cache.service';
import { MetricsService } from '../../../infra/metrics/metrics.service';

import {
  FLIGHT_SEARCH_PROVIDER,
  type FlightSearchProvider,
} from '../providers/flight-search.provider';
import { FlightOfferMapper } from './flight-offer.mapper';
import {
  FlightSearchCursorPayload,
  PreprocessedFlightOffer,
  SortType,
} from '../types/flights.types';
import { computeBestScores } from '../utils/best-score.util';
import {
  appendFiltersToSearchParams,
  applyFlightFilters,
  buildFilters,
  parseFlightSearchFilters,
} from '../utils/filter.util';
import type { FlightSearchFilters } from '../utils/filter.util';
import { preprocessOffers } from '../utils/preprocess-offers.util';
import { getFlightSortStrategy, sortFlightOffers } from '../utils/flight-sort-strategies.util';
import {
  buildCursor,
  cursorToFakeOffer,
  decodeCursor,
  encodeCursor,
} from '../../../shared/utils/cursor.util';
import { buildSearchQueryKey } from '../utils/search-query-key.util';
import { validatePassengerCounts } from 'src/shared/booking/passenger-counts.util';
import { assertValidSearchDirections } from '../utils/validate-search-directions.util';
import { resolveDefaultSearchCurrencyCode } from 'src/modules/payment/utils/payment-defaults.util';
import { FlightScheduleSyncService } from './flight-schedule-sync.service';

@Injectable()
export class FlightsService {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 50;

  constructor(
    @Inject(FLIGHT_SEARCH_PROVIDER)
    private readonly provider: FlightSearchProvider,

    private readonly searchStore: FlightsSearchStore,
    private readonly offerMapper: FlightOfferMapper,
    private readonly metrics: MetricsService,
    private readonly scheduleSync: FlightScheduleSyncService,
  ) {}

  async createSearch(data: SearchFlightsDto, query: FlightsQueryDto = {}) {
    const sort = query.sort ?? 'CHEAPEST';
    const filters = parseFlightSearchFilters(query);
    const limit = this.normalizeLimit(query.limit);
    validatePassengerCounts(data.passengers);
    assertValidSearchDirections(data.directions);

    if (!data.currencyCode) {
      data.currencyCode = resolveDefaultSearchCurrencyCode();
    }

    const { origin, destination } = this.getSearchRouteLabels(data);
    const timer = this.metrics.flightSearchDuration.startTimer({ origin });
    let recorded = false;

    const finish = (status: 'cache' | 'success' | 'failure') => {
      if (recorded) {
        return;
      }
      recorded = true;
      this.metrics.recordFlightSearch(origin, destination, status);
      timer({ origin, status });
    };

    try {
      const queryKey = buildSearchQueryKey(data);
      const cachedSearch = await this.getCachedSearch(queryKey, sort, filters, limit);

      if (cachedSearch) {
        this.metrics.recordRedisCache('flight_search', 'hit');
        finish('cache');
        return cachedSearch;
      }

      this.metrics.recordRedisCache('flight_search', 'miss');

      let lockAcquired = await this.searchStore.acquireSearchLock(queryKey);
      this.metrics.recordRedisLock('flight_search', lockAcquired ? 'acquired' : 'busy');

      if (!lockAcquired) {
        const peerSearch = await this.waitForPeerSearch(queryKey, sort, filters, limit);
        if (peerSearch) {
          this.metrics.recordRedisCache('flight_search', 'hit');
          finish('cache');
          return peerSearch;
        }

        lockAcquired = await this.searchStore.acquireSearchLock(queryKey);
        this.metrics.recordRedisLock('flight_search', lockAcquired ? 'acquired' : 'busy');
        if (!lockAcquired) {
          finish('failure');
          throw new ServiceUnavailableException(
            'Flight search is still in progress. Please retry in a few seconds.',
          );
        }
      }

      try {
        const cachedAfterLock = await this.getCachedSearch(queryKey, sort, filters, limit);
        if (cachedAfterLock) {
          this.metrics.recordRedisCache('flight_search', 'hit');
          finish('cache');
          return cachedAfterLock;
        }

        const response = await this.provider.searchFlights({
          directions: data.directions,
          passengers: data.passengers,
          travelClass: data.travelClass,
          currencyCode: data.currencyCode,
          limit: FlightsService.DEFAULT_LIMIT,
        });

        const rawOffers = response?.data ?? [];
        const preprocessedOffers = preprocessOffers(rawOffers);
        const searchId = randomUUID();

        const searchContext = {
          passengers: {
            adults: data.passengers.adults,
            children: data.passengers.children ?? 0,
            infants: data.passengers.infants ?? 0,
            seatedInfants: data.passengers.seatedInfants ?? 0,
          },
          travelClass: data.travelClass,
          currencyCode: data.currencyCode,
        };

        const cacheTtlSeconds =
          preprocessedOffers.length === 0 ? EMPTY_SEARCH_TTL_SECONDS : undefined;

        const { expiresAt } = await this.searchStore.saveSearchResults(
          searchId,
          preprocessedOffers,
          queryKey,
          searchContext,
          cacheTtlSeconds,
        );

        let effectiveSearchId: string = searchId;
        let offersForResponse = preprocessedOffers;
        let effectiveExpiresAt = expiresAt;

        const savedQueryMapping = await this.searchStore.saveSearchIdByQueryIfAbsent(
          queryKey,
          searchId,
          cacheTtlSeconds,
        );

        if (!savedQueryMapping) {
          const existingSearchId = await this.searchStore.getSearchIdByQuery(queryKey);
          if (existingSearchId) {
            effectiveSearchId = existingSearchId;
            await this.searchStore.deleteSearchResults(searchId);

            const existing = await this.searchStore.getSearchResults(existingSearchId);
            if (existing) {
              offersForResponse = existing.offers as PreprocessedFlightOffer[];
              effectiveExpiresAt = existing.expiresAt;
            }
          }
        }

        computeBestScores(offersForResponse);

        const sortedOffers = sortFlightOffers(offersForResponse, sort);

        const result = this.buildSearchResponse({
          searchId: effectiveSearchId,
          offers: sortedOffers,
          limit,
          expiresAt: effectiveExpiresAt,
          sort,
          searchHash: queryKey,
          filters,
        });

        finish('success');

        return result;
      } finally {
        if (lockAcquired) {
          await this.searchStore.releaseSearchLock(queryKey);
        }
      }
    } catch (error) {
      finish('failure');
      throw error;
    }
  }

  private async waitForPeerSearch(
    queryHash: string,
    sort: SortType,
    filters: FlightSearchFilters,
    limit: number,
  ) {
    const searchId = await this.searchStore.waitForSearchIdByQuery(queryHash);
    if (!searchId) {
      return null;
    }

    return this.getCachedSearch(queryHash, sort, filters, limit);
  }

  private getSearchRouteLabels(data: SearchFlightsDto): { origin: string; destination: string } {
    const firstDirection = data.directions[0];

    if (!firstDirection) {
      return { origin: 'unknown', destination: 'unknown' };
    }

    return {
      origin: firstDirection.origin,
      destination: firstDirection.destination,
    };
  }

  async getSearchPage(searchId: string, query: FlightsQueryDto = {}) {
    const cached = await this.searchStore.getSearchResults(searchId);

    if (!cached) {
      throw new NotFoundException('Search expired or not found. Please initiate a new search.');
    }

    const safeLimit = this.normalizeLimit(query.limit);
    const sort = query.sort ?? 'CHEAPEST';
    const filters = parseFlightSearchFilters(query);
    const preprocessedOffers = cached.offers as PreprocessedFlightOffer[];
    const liveOffers = await this.scheduleSync.refreshOffersFromDatabase(preprocessedOffers, {
      passengers: cached.context?.passengers,
    });
    computeBestScores(liveOffers);

    const effectiveSort = this.resolveSortForCursor(query.cursor, sort, cached.queryHash);
    const sortedOffers = sortFlightOffers(liveOffers, effectiveSort);
    const searchHash = cached.queryHash;
    return this.buildSearchResponse({
      searchId,
      offers: sortedOffers,
      expiresAt: cached.expiresAt,
      cursor: query.cursor,
      limit: safeLimit,
      sort: effectiveSort,
      searchHash,
      filters,
    });
  }

  private async getCachedSearch(
    queryHash: string,
    sort: SortType,
    filters: FlightSearchFilters,
    limit: number,
  ) {
    const cachedSearchId = await this.searchStore.getSearchIdByQuery(queryHash);

    if (!cachedSearchId) {
      return null;
    }

    const cached = await this.searchStore.getSearchResults(cachedSearchId);

    if (!cached) {
      await this.searchStore.deleteSearchIdByQuery(queryHash);
      return null;
    }

    const preprocessedOffers = cached.offers as PreprocessedFlightOffer[];
    const liveOffers = await this.scheduleSync.refreshOffersFromDatabase(preprocessedOffers, {
      passengers: cached.context?.passengers,
    });
    computeBestScores(liveOffers);
    const sortedOffers = sortFlightOffers(liveOffers, sort);

    return this.buildSearchResponse({
      searchId: cachedSearchId,
      offers: sortedOffers,
      expiresAt: cached.expiresAt,
      limit,
      sort,
      searchHash: queryHash,
      filters,
    });
  }

  private resolveSortForCursor(
    cursor: string | undefined,
    requestedSort: SortType,
    searchHash: string,
  ): SortType {
    if (!cursor) {
      return requestedSort;
    }

    const decoded = decodeCursor<FlightSearchCursorPayload>(cursor);
    if (!decoded) {
      return requestedSort;
    }

    if (decoded.searchHash !== searchHash) {
      throw new BadRequestException('Cursor search mismatch');
    }

    return decoded.sort ?? requestedSort;
  }

  private buildSearchResponse(params: {
    searchId: string;
    offers: PreprocessedFlightOffer[];
    cursor?: string;
    limit: number;
    expiresAt?: string;
    sort: SortType;
    searchHash: string;
    filters?: FlightSearchFilters;
  }) {
    const { searchId, offers, cursor, limit, sort, searchHash, expiresAt, filters = {} } = params;

    const filteredOffers = applyFlightFilters(offers, filters);
    const page = this.paginateOffers(filteredOffers, cursor, limit, sort, searchHash);

    return {
      searchId,
      data: this.mapOffersToCards(page.data),
      meta: {
        total: filteredOffers.length,
        ...page.meta,
      },
      links: this.buildLinks(searchId, page.nextCursor, limit, sort, filters),
      expiresAt: expiresAt ?? null,
      filters: buildFilters(offers),
    };
  }

  private paginateOffers(
    items: PreprocessedFlightOffer[],
    cursor: string | undefined,
    limit: number,
    sort: SortType,
    searchHash: string,
  ) {
    const decoded = decodeCursor<FlightSearchCursorPayload>(cursor);
    const effectiveSort = this.resolveSortForCursor(cursor, sort, searchHash);

    let startIndex = 0;

    if (decoded) {
      if (decoded.searchHash !== searchHash) {
        throw new BadRequestException('Cursor search mismatch');
      }

      startIndex = this.findStartIndex(items, decoded, effectiveSort);
    }

    const pageItems = items.slice(startIndex, startIndex + limit);

    const hasNextPage = items.length > startIndex + limit;
    const lastItem = pageItems[pageItems.length - 1];

    const nextCursor =
      hasNextPage && lastItem
        ? encodeCursor<FlightSearchCursorPayload>(buildCursor(lastItem, effectiveSort, searchHash))
        : null;

    return {
      data: pageItems,
      meta: {
        limit,
        hasNextPage,
      },
      nextCursor,
    };
  }

  private buildLinks(
    searchId: string,
    nextCursor: string | null,
    limit: number,
    sort: SortType,
    filters: FlightSearchFilters,
  ) {
    const filterParams = new URLSearchParams();
    appendFiltersToSearchParams(filterParams, filters);

    const filterQuery = filterParams.toString();
    const filterSuffix = filterQuery ? `&${filterQuery}` : '';

    return {
      next: nextCursor
        ? `/api/v1/flights/search/${searchId}?cursor=${nextCursor}&limit=${limit}&sort=${sort}${filterSuffix}`
        : null,
    };
  }

  private mapOffersToCards(offers: PreprocessedFlightOffer[]) {
    return offers.map((offer) => this.offerMapper.toCard(offer));
  }

  private findStartIndex(
    items: PreprocessedFlightOffer[],
    cursor: FlightSearchCursorPayload,
    sort: SortType,
  ): number {
    const strategy = getFlightSortStrategy(sort);

    const cursorOffer = cursorToFakeOffer(cursor);

    for (let i = 0; i < items.length; i++) {
      const cmp = strategy.compare(items[i], cursorOffer as PreprocessedFlightOffer);

      if (cmp > 0) {
        return i;
      }

      if (cmp === 0 && items[i].id > cursor.id) {
        return i;
      }
    }

    return items.length;
  }

  private normalizeLimit(limit?: number) {
    return Math.min(
      Math.max(Number(limit) || FlightsService.DEFAULT_LIMIT, 1),
      FlightsService.MAX_LIMIT,
    );
  }
}
