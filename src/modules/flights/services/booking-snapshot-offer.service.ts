import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightsSearchStore, type CachedSearchContext } from './flights-cache.service';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { FlightPricingResponse } from '../dtos';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';

export type ResolvedOfferContext = {
  offer: FlightOffer;
  searchContext: CachedSearchContext | null;
  offerCurrency: string;
  pricingHint: FlightPricingResponse | null;
};

@Injectable()
export class BookingSnapshotOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchStore: FlightsSearchStore,
  ) {}

  async resolveOfferContext(
    searchId: string,
    offerId: string,
    bookingId?: string,
  ): Promise<ResolvedOfferContext | null> {
    const cached = await this.searchStore.getOfferWithContext(searchId, offerId);
    if (cached) {
      const offerCurrency = cached.offer.currencyCode ?? cached.offer.price.currency;
      return {
        offer: cached.offer,
        searchContext: cached.context,
        offerCurrency,
        pricingHint: null,
      };
    }

    if (!bookingId) {
      return null;
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { snapshot: true },
    });

    if (!booking?.snapshot) {
      return null;
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    if (!this.snapshotMatchesSearch(snapshot, searchId, offerId)) {
      return null;
    }

    const offer = snapshot.offer;
    const offerCurrency = offer.currencyCode ?? offer.price.currency;

    return {
      offer,
      searchContext: null,
      offerCurrency,
      pricingHint: snapshot.pricing ?? null,
    };
  }

  private snapshotMatchesSearch(
    snapshot: BookingSnapshot,
    searchId: string,
    offerId: string,
  ): boolean {
    if (snapshot.searchId && snapshot.searchId !== searchId) {
      return false;
    }

    const snapshotOfferId = snapshot.offerId ?? snapshot.offer?.id;
    return snapshotOfferId === offerId;
  }
}
