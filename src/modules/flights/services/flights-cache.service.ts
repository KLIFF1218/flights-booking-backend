import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/redis.service';
import { FlightOffer } from '../interfaces/flight-offers.interface';
import { FlightPricingResponse } from '../dtos';
import { FlightOffersPricingResponse } from '../interfaces/flight-offer-pricing.interface';
import type { TravelClass } from '../interfaces/flight-offers.interface';

const DEFAULT_TTL_SECONDS = 15 * 60;
/** Empty result sets expire quickly so a later admin create is not stuck behind a long negative cache. */
export const EMPTY_SEARCH_TTL_SECONDS = 60;
const SEARCH_LOCK_TTL_SECONDS = 60;
const SEARCH_WAIT_MAX_MS = 30_000;
const SEARCH_WAIT_POLL_MS = 100;

export type CachedSearchPassengers = {
  adults: number;
  children: number;
  infants: number;
  seatedInfants: number;
};

export type CachedSearchContext = {
  passengers: CachedSearchPassengers;
  travelClass: TravelClass;
  currencyCode?: string;
};

type CachedSearchResult = {
  offers: FlightOffer[];
  expiresAt: string;
  queryHash: string;
  context?: CachedSearchContext;
};

@Injectable()
export class FlightsSearchStore {
  private readonly searchPrefix = 'flights:search';
  private readonly searchQueryPrefix = 'flights:search:query';
  private readonly searchLockPrefix = 'flights:search:lock';
  private readonly basePricingPrefix = 'flights:pricing:base';
  private readonly lastPricingPrefix = 'flights:pricing:last';
  private readonly seatmapPrefix = 'flights:seatmap';

  constructor(private readonly redisService: RedisService) {}

  private searchKey(searchId: string): string {
    return `${this.searchPrefix}:${searchId}`;
  }

  private searchQueryKey(queryKey: string): string {
    return `${this.searchQueryPrefix}:${queryKey}`;
  }

  private searchLockKey(queryKey: string): string {
    return `${this.searchLockPrefix}:${queryKey}`;
  }

  private basePricingKey(searchId: string, offerId: string): string {
    return `${this.basePricingPrefix}:${searchId}:${offerId}`;
  }

  private lastPricingKey(searchId: string, offerId: string): string {
    return `${this.lastPricingPrefix}:${searchId}:${offerId}`;
  }

  private seatmapKey(searchId: string, offerId: string): string {
    return `${this.seatmapPrefix}:${searchId}:${offerId}`;
  }

  async saveSearchResults(
    searchId: string,
    offers: FlightOffer[],
    queryHash: string,
    context: CachedSearchContext,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<{
    expiresAt: string;
  }> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const payload: CachedSearchResult = {
      offers,
      expiresAt,
      queryHash,
      context,
    };

    await this.redisService.set(this.searchKey(searchId), payload, ttlSeconds);

    return {
      expiresAt,
    };
  }

  async getSearchResults(searchId: string): Promise<CachedSearchResult | null> {
    return this.redisService.get<CachedSearchResult>(this.searchKey(searchId));
  }

  async getSearchIdByQuery(queryKey: string): Promise<string | null> {
    return this.redisService.get<string>(this.searchQueryKey(queryKey));
  }

  async acquireSearchLock(
    queryKey: string,
    ttlSeconds = SEARCH_LOCK_TTL_SECONDS,
  ): Promise<boolean> {
    return this.redisService.setIfNotExists(this.searchLockKey(queryKey), '1', ttlSeconds);
  }

  async releaseSearchLock(queryKey: string): Promise<void> {
    await this.redisService.delete(this.searchLockKey(queryKey));
  }

  async waitForSearchIdByQuery(
    queryKey: string,
    maxWaitMs = SEARCH_WAIT_MAX_MS,
    pollIntervalMs = SEARCH_WAIT_POLL_MS,
  ): Promise<string | null> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const searchId = await this.getSearchIdByQuery(queryKey);
      if (searchId) {
        const results = await this.getSearchResults(searchId);
        if (results) {
          return searchId;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  async saveSearchIdByQuery(
    queryKey: string,
    searchId: string,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.searchQueryKey(queryKey), searchId, ttlSeconds);
  }

  async saveSearchIdByQueryIfAbsent(
    queryKey: string,
    searchId: string,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<boolean> {
    return this.redisService.setIfNotExists(this.searchQueryKey(queryKey), searchId, ttlSeconds);
  }

  async deleteSearchResults(searchId: string): Promise<void> {
    await this.redisService.delete(this.searchKey(searchId));
  }

  async deleteSearchIdByQuery(queryKey: string): Promise<number> {
    return this.redisService.delete(this.searchQueryKey(queryKey));
  }

  async getOffer(searchId: string, offerId: string): Promise<FlightOffer | null> {
    const cached = await this.getSearchResults(searchId);

    return cached?.offers.find((o) => o.id === offerId) ?? null;
  }

  async getOfferWithContext(
    searchId: string,
    offerId: string,
  ): Promise<{ offer: FlightOffer; context: CachedSearchContext | null } | null> {
    const cached = await this.getSearchResults(searchId);
    if (!cached) {
      return null;
    }

    const offer = cached.offers.find((o) => o.id === offerId);
    if (!offer) {
      return null;
    }

    return {
      offer,
      context: cached.context ?? null,
    };
  }

  async replaceOfferInSearch(searchId: string, offerId: string, offer: FlightOffer): Promise<void> {
    const cached = await this.getSearchResults(searchId);
    if (!cached) {
      return;
    }

    const index = cached.offers.findIndex((o) => o.id === offerId);
    if (index === -1) {
      return;
    }

    cached.offers[index] = offer;

    const expiresAtMs = new Date(cached.expiresAt).getTime();
    const ttlSeconds = Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000));

    await this.redisService.set(this.searchKey(searchId), cached, ttlSeconds);
  }

  async saveBasePricing(
    searchId: string,
    offerId: string,
    pricing: FlightOffersPricingResponse,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.basePricingKey(searchId, offerId), pricing, ttlSeconds);
  }

  async getBasePricing(
    searchId: string,
    offerId: string,
  ): Promise<FlightOffersPricingResponse | null> {
    return this.redisService.get<FlightOffersPricingResponse>(
      this.basePricingKey(searchId, offerId),
    );
  }

  async saveLastPricing(
    searchId: string,
    offerId: string,
    pricing: FlightPricingResponse,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.lastPricingKey(searchId, offerId), pricing, ttlSeconds);
  }

  async getLastPricing(searchId: string, offerId: string): Promise<FlightPricingResponse | null> {
    return this.redisService.get<FlightPricingResponse>(this.lastPricingKey(searchId, offerId));
  }

  async saveSeatMap(
    searchId: string,
    offerId: string,
    seatmap: unknown,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.seatmapKey(searchId, offerId), seatmap, ttlSeconds);
  }

  async getSeatMap(searchId: string, offerId: string) {
    return this.redisService.get<unknown>(this.seatmapKey(searchId, offerId));
  }

  async extendOfferCachesForBooking(
    searchId: string,
    offerId: string,
    expiresAt: Date,
  ): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    if (ttlSeconds <= 0) {
      return;
    }

    const keys = [
      this.searchKey(searchId),
      this.lastPricingKey(searchId, offerId),
      this.basePricingKey(searchId, offerId),
      this.seatmapKey(searchId, offerId),
    ];

    await Promise.all(keys.map((key) => this.redisService.expire(key, ttlSeconds)));

    const cached = await this.getSearchResults(searchId);
    if (cached) {
      await this.redisService.set(
        this.searchKey(searchId),
        { ...cached, expiresAt: expiresAt.toISOString() },
        ttlSeconds,
      );
    }
  }

  async deleteSeatMap(searchId: string, offerId: string): Promise<number> {
    return this.redisService.delete(this.seatmapKey(searchId, offerId));
  }

  async invalidateOfferPricing(searchId: string, offerId: string): Promise<void> {
    await Promise.all([
      this.redisService.delete(this.lastPricingKey(searchId, offerId)),
      this.redisService.delete(this.basePricingKey(searchId, offerId)),
      this.redisService.delete(this.seatmapKey(searchId, offerId)),
    ]);
  }

  /**
   * Drop all cached searches / pricing so the next request rebuilds from DB.
   * Used after catalog mutations that cannot be patched into existing offer lists (e.g. create).
   */
  async invalidateAllSearchCaches(): Promise<number> {
    const deleted = await Promise.all([
      this.redisService.delByPrefix(`${this.searchPrefix}:`),
      this.redisService.delByPrefix(`${this.basePricingPrefix}:`),
      this.redisService.delByPrefix(`${this.lastPricingPrefix}:`),
      this.redisService.delByPrefix(`${this.seatmapPrefix}:`),
    ]);

    return deleted.reduce((sum, count) => sum + count, 0);
  }

  private isSearchResultsKey(key: string): boolean {
    if (!key.startsWith(`${this.searchPrefix}:`)) {
      return false;
    }

    return !key.includes(':query:') && !key.includes(':lock:');
  }

  async mutateCachedOffers(
    mutator: (
      searchId: string,
      cached: CachedSearchResult,
    ) => Promise<CachedSearchResult | null> | CachedSearchResult | null,
  ): Promise<void> {
    const client = this.redisService.getClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${this.searchPrefix}:*`,
        'COUNT',
        50,
      );
      cursor = nextCursor;

      for (const key of keys) {
        if (!this.isSearchResultsKey(key)) {
          continue;
        }

        const searchId = key.slice(this.searchPrefix.length + 1);
        const cached = await this.getSearchResults(searchId);
        if (!cached) {
          continue;
        }

        const updated = await mutator(searchId, cached);
        if (!updated) {
          continue;
        }

        const ttl = await client.ttl(key);
        const ttlSeconds = ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
        await this.redisService.set(key, updated, ttlSeconds);
      }
    } while (cursor !== '0');
  }
}
