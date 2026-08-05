import { Injectable } from '@nestjs/common';
import { FlightStatus } from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { FlightsSearchStore, type CachedSearchPassengers } from './flights-cache.service';
import { flightInstanceInclude } from '../providers/prisma/flight-instance.include';
import {
  applyInstanceSchedulesToOffer,
  offerReferencesFlightInstance,
  patchOfferSegmentFromInstance,
} from '../utils/offer/offer-schedule.util';
import {
  isOfferInventoryBookable,
  resolveOfferBookableSeats,
} from '../utils/offer/offer-inventory.util';

export type RefreshOffersOptions = {
  passengers?: CachedSearchPassengers;
};

@Injectable()
export class FlightScheduleSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchStore: FlightsSearchStore,
    private readonly logger: Logger,
  ) {}

  /**
   * New instances cannot be inserted into existing cached offer lists — wipe search caches
   * so the next search hits the database.
   */
  async onFlightInstanceCreated(flightInstanceId: string): Promise<void> {
    const deleted = await this.searchStore.invalidateAllSearchCaches();

    this.logger.log(
      { flightInstanceId, deletedKeys: deleted },
      'Invalidated flight search caches after instance create',
    );
  }

  async onFlightInstanceUpdated(flightInstanceId: string): Promise<void> {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: flightInstanceId },
      include: flightInstanceInclude,
    });

    if (!instance) {
      return;
    }

    const pricingInvalidations: Array<{ searchId: string; offerId: string }> = [];

    await this.searchStore.mutateCachedOffers(async (searchId, cached) => {
      const nextOffers: FlightOffer[] = [];
      let changed = false;

      for (const offer of cached.offers) {
        if (!offerReferencesFlightInstance(offer, flightInstanceId)) {
          nextOffers.push(offer);
          continue;
        }

        pricingInvalidations.push({ searchId, offerId: offer.id });

        if (
          instance.status === FlightStatus.CANCELLED ||
          instance.status === FlightStatus.COMPLETED
        ) {
          changed = true;
          continue;
        }

        const patched = patchOfferSegmentFromInstance(offer, instance);
        nextOffers.push(patched.offer);
        changed = true;
      }

      if (!changed) {
        return cached;
      }

      return {
        ...cached,
        offers: nextOffers,
      };
    });

    await Promise.all(
      pricingInvalidations.map(({ searchId, offerId }) =>
        this.searchStore.invalidateOfferPricing(searchId, offerId),
      ),
    );

    this.logger.log(
      {
        flightInstanceId,
        status: instance.status,
        invalidatedOffers: pricingInvalidations.length,
      },
      'Synced cached offers after flight schedule change',
    );
  }

  async refreshOffersFromDatabase<T extends FlightOffer>(
    offers: T[],
    options: RefreshOffersOptions = {},
  ): Promise<T[]> {
    if (offers.length === 0) {
      return offers;
    }

    const instanceIds = [
      ...new Set(
        offers.flatMap((offer) =>
          offer.itineraries.flatMap((itinerary) =>
            itinerary.segments.map((segment) => segment.flightInstanceId),
          ),
        ),
      ),
    ];

    const instances = await this.prisma.flightInstance.findMany({
      where: { id: { in: instanceIds } },
      include: flightInstanceInclude,
    });
    const instancesMap = new Map(instances.map((instance) => [instance.id, instance]));

    const refreshed: T[] = [];

    for (const offer of offers) {
      if (!isOfferInventoryBookable(offer, instancesMap, options.passengers)) {
        continue;
      }

      const snapshot = applyInstanceSchedulesToOffer(offer, instancesMap);
      const bookableSeats = resolveOfferBookableSeats(offer, instancesMap);

      refreshed.push({
        ...snapshot.offer,
        numberOfBookableSeats: bookableSeats ?? snapshot.offer.numberOfBookableSeats,
      } as T);
    }

    return refreshed;
  }
}
