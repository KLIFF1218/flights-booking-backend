import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { createHash, randomUUID } from 'node:crypto';

import { SearchFlightsDto } from '../dtos';
import { FlightCardResponse } from '../interfaces/flight-response.dto';
import { FlightOffer, Itinerary } from '../interfaces/flight-offers.interface';

import { FlightsSearchStore } from '../services/flights-cache.service';

import { MetricsService } from '../../../infra/metrics/metrics.service';

import {
  FLIGHT_SEARCH_PROVIDER,
  type FlightSearchProvider,
} from '../providers/flight-search.provider';

type CursorPayload = {
  price: number;
  id: string;
};

@Injectable()
export class FlightsService {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 50;

  constructor(
    @Inject(FLIGHT_SEARCH_PROVIDER)
    private readonly provider: FlightSearchProvider,

    private readonly searchStore: FlightsSearchStore,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {}

  async createSearch(data: SearchFlightsDto) {
    const timer = this.metrics.flightSearchDuration.startTimer();

    const cachedSearch = await this.getCachedSearch(this.buildSearchQueryKey(data));

    if (cachedSearch) {
      this.metrics.flightSearchCounter.inc({
        status: 'cache',
      });

      timer({
        status: 'cache',
      });

      return cachedSearch;
    }

    const response = await this.provider.searchFlights({
      directions: data.directions,
      passengers: data.passengers,
      travelClass: data.travelClass,
      limit: FlightsService.DEFAULT_LIMIT,
    });

    const rawOffers = this.sortOffers(response?.data ?? []);
    const searchId = randomUUID();

    await this.searchStore.saveSearchResults(searchId, rawOffers);
    await this.searchStore.saveSearchIdByQuery(this.buildSearchQueryKey(data), searchId);

    const result = this.buildSearchResponse({
      searchId,
      offers: rawOffers,
      limit: FlightsService.DEFAULT_LIMIT,
    });

    this.metrics.flightSearchCounter.inc({
      status: 'success',
    });

    timer({
      status: 'success',
    });

    return result;
  }

  async getSearchPage(searchId: string, cursor?: string, limit: number = 20) {
    const cachedOffers = await this.searchStore.getSearchResults(searchId);

    if (!cachedOffers) {
      throw new NotFoundException('Search expired or not found');
    }

    const safeLimit = this.normalizeLimit(limit);

    return this.buildSearchResponse({
      searchId,
      offers: cachedOffers,
      cursor,
      limit: safeLimit,
    });
  }

  private async getCachedSearch(queryHash: string) {
    const cachedSearchId = await this.searchStore.getSearchIdByQuery(queryHash);

    if (!cachedSearchId) {
      return null;
    }

    const cachedOffers = await this.searchStore.getSearchResults(cachedSearchId);

    if (!cachedOffers) {
      await this.searchStore.deleteSearchIdByQuery(queryHash);

      return null;
    }

    return this.buildSearchResponse({
      searchId: cachedSearchId,
      offers: cachedOffers,
      limit: FlightsService.DEFAULT_LIMIT,
    });
  }

  private buildSearchResponse(params: {
    searchId: string;
    offers: FlightOffer[];
    cursor?: string;
    limit: number;
  }) {
    const { searchId, offers, cursor, limit } = params;

    const { data, meta, nextCursor } = this.paginateOffers(offers, cursor, limit);

    return {
      searchId,

      data: data.map((offer) => this.mapOfferToCard(offer)),

      meta: {
        total: offers.length,
        ...meta,
      },

      links: {
        next: nextCursor
          ? `/api/v1/flights/search/${searchId}?cursor=${nextCursor}&limit=${limit}`
          : null,
      },

      filters: this.buildFilters(offers),
    };
  }

  private mapOfferToCard(offer: FlightOffer): FlightCardResponse {
    const routes = offer.itineraries.map((itinerary) => {
      const segments = this.mapSegments(itinerary);

      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      return {
        availableSeats: offer.numberOfBookableSeats,

        from: firstSegment.from,
        to: lastSegment.to,

        departure: {
          airport: firstSegment.from,
          time: firstSegment.departureTime,
          date: firstSegment.departureTime,
        },

        arrival: {
          airport: lastSegment.to,
          time: lastSegment.arrivalTime,
          date: lastSegment.arrivalTime,
        },

        durationMinutes: this.parseDuration(itinerary.duration),

        stops: Math.max(segments.length - 1, 0),

        stopCodes: segments.map((segment) => segment.to).slice(0, -1),

        airline: firstSegment.airline,
        airlineIata: firstSegment.airlineIata,

        segments,
      };
    });

    return {
      offerId: offer.id,

      price: {
        total: Number(offer.price.total),
        currency: offer.price.currency,
      },

      routes,

      totalDurationMinutes: routes.reduce((sum, route) => sum + route.durationMinutes, 0),
    };
  }

  private mapSegments(itinerary: Itinerary) {
    return itinerary.segments.map((segment) => ({
      from: segment.departure.iataCode,
      to: segment.arrival.iataCode,

      departureTime: segment.departure.at,
      arrivalTime: segment.arrival.at,

      airline: segment.carrierName ?? segment.carrierCode,
      airlineIata: segment.carrierCode,

      flightNumber: segment.number,

      durationMinutes: this.parseDuration(segment.duration),
    }));
  }

  private parseDuration(duration?: string): number {
    if (!duration) {
      return 0;
    }

    const hours = Number(duration.match(/(\d+)H/)?.[1] ?? 0);

    const minutes = Number(duration.match(/(\d+)M/)?.[1] ?? 0);

    return hours * 60 + minutes;
  }

  private buildFilters(offers: FlightOffer[]) {
    const airlinesMap = new Map<string, number>();
    const stopsMap = new Map<number, number>();

    let maxPrice = 0;

    for (const offer of offers) {
      const firstItinerary = offer.itineraries[0];

      if (!firstItinerary) {
        continue;
      }

      const firstSegment = firstItinerary.segments[0];

      if (!firstSegment) {
        continue;
      }

      const airline = firstSegment.carrierName ?? firstSegment.carrierCode;

      airlinesMap.set(airline, (airlinesMap.get(airline) ?? 0) + 1);

      const stops = Math.max(firstItinerary.segments.length - 1, 0);

      stopsMap.set(stops, (stopsMap.get(stops) ?? 0) + 1);

      const price = Number(offer.price.total);

      if (!Number.isNaN(price)) {
        maxPrice = Math.max(maxPrice, price);
      }
    }

    return {
      airlines: Array.from(airlinesMap.entries()).map(([name, count]) => ({
        name,
        count,
      })),

      stops: Array.from(stopsMap.entries()).map(([stops, count]) => ({
        stops,
        count,
      })),

      maxPrice,
    };
  }

  private buildSearchQueryKey(data: SearchFlightsDto) {
    const normalized = {
      directions: data.directions.map((direction) => ({
        origin: direction.origin,
        destination: direction.destination,
        dateFrom: direction.dateFrom,
      })),

      passengers: {
        adults: data.passengers.adults,
        children: data.passengers.children ?? 0,
        infants: data.passengers.infants ?? 0,
      },

      travelClass: data.travelClass,

      currencyCode: data.currencyCode ?? null,
    };

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private normalizeLimit(limit?: number) {
    return Math.min(
      Math.max(Number(limit) || FlightsService.DEFAULT_LIMIT, 1),
      FlightsService.MAX_LIMIT,
    );
  }

  private decodeCursor(cursor?: string): CursorPayload | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = Buffer.from(cursor, 'base64url').toString();

      const parsed: unknown = JSON.parse(decoded);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('price' in parsed) ||
        !('id' in parsed)
      ) {
        throw new BadRequestException('Invalid cursor');
      }

      const payload = parsed as CursorPayload;

      if (typeof payload.price !== 'number' || typeof payload.id !== 'string') {
        throw new BadRequestException('Invalid cursor');
      }

      return payload;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private encodeCursor(payload: CursorPayload) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private sortOffers(offers: FlightOffer[]) {
    return [...offers].sort((a, b) => {
      const priceDiff = Number(a.price.total) - Number(b.price.total);

      if (priceDiff !== 0) {
        return priceDiff;
      }

      return a.id.localeCompare(b.id);
    });
  }

  private paginateOffers(
    items: FlightOffer[],
    cursor?: string,
    limit: number = FlightsService.DEFAULT_LIMIT,
  ) {
    const decoded = this.decodeCursor(cursor);

    let filteredItems = items;

    if (decoded) {
      filteredItems = items.filter((offer) => {
        const price = Number(offer.price.total);

        if (price > decoded.price) {
          return true;
        }

        if (price === decoded.price) {
          return offer.id > decoded.id;
        }

        return false;
      });
    }

    const sliced = filteredItems.slice(0, limit + 1);

    const hasNextPage = sliced.length > limit;

    const pageItems = sliced.slice(0, limit);

    const lastItem = pageItems[pageItems.length - 1];

    const nextCursor =
      hasNextPage && lastItem
        ? this.encodeCursor({
            price: Number(lastItem.price.total),
            id: lastItem.id,
          })
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
}
