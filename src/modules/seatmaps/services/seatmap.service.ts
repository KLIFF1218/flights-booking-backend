import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { FlightsSearchStore } from '../../flights/services/flights-cache.service';
import { BookingSnapshotOfferService } from '../../flights/services/booking-snapshot-offer.service';
import { SeatMapDto, SeatMapResponseDto, SingleSegmentSeatMapResponse } from '../dtos/seatmap.dto';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { buildSegmentSeatMap, type SegmentSeatMapInstance } from './seat-grid.builder';

const seatMapInstanceInclude = {
  aircraft: {
    include: {
      aircraftLayout: {
        include: {
          facilities: true,
        },
      },
    },
  },
  fares: {
    take: 1,
  },
} satisfies Prisma.FlightInstanceInclude;

type SeatMapFlightInstance = Prisma.FlightInstanceGetPayload<{
  include: typeof seatMapInstanceInclude;
}> & {
  seats: SegmentSeatMapInstance['seats'];
};

type SeatMapSegmentContext = {
  segmentId: string;
  flightInstanceId: string;
};

@Injectable()
export class SeatMapsService {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingSnapshotOffer: BookingSnapshotOfferService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async getSeatMapByOffer(dto: SeatMapDto): Promise<SeatMapResponseDto> {
    return this.getSeatMap(dto);
  }

  async getSeatMap(dto: SeatMapDto): Promise<SeatMapResponseDto> {
    const resolved = await this.bookingSnapshotOffer.resolveOfferContext(
      dto.searchId,
      dto.offerId,
      dto.bookingId,
    );

    if (!resolved) {
      throw new NotFoundException('Offer not found');
    }

    const offer = resolved.offer;

    const targetCurrency = offer.currencyCode ?? offer.price.currency;
    const segmentContexts = this.collectSegmentContexts(offer);

    if (!segmentContexts.length) {
      return { unavailable: true, seatMaps: [] };
    }

    // Prefer quote-locked FX so seatmap minPrice matches pricing/checkout totals.
    const lastPricing =
      (await this.searchStore.getLastPricing(dto.searchId, dto.offerId)) ?? resolved.pricingHint;
    const fxRates = lastPricing?.fxRates;

    const instances = await this.loadFlightInstances(segmentContexts);
    const instanceById = new Map(instances.map((instance) => [instance.id, instance]));

    const seatMaps: SingleSegmentSeatMapResponse[] = [];

    for (const context of segmentContexts) {
      const instance = instanceById.get(context.flightInstanceId);

      if (!instance) {
        throw new ConflictException('Flight instance is not configured');
      }

      if (!instance.seats.length) {
        continue;
      }

      const segmentSeatMap = buildSegmentSeatMap(
        instance,
        context.segmentId,
        targetCurrency,
        fxRates,
      );

      runSafely(() =>
        this.metrics.updateSeatsAvailable(
          segmentSeatMap.availableSeatsCount,
          segmentSeatMap.aircraft,
        ),
      );

      seatMaps.push(segmentSeatMap);
    }

    if (!seatMaps.length) {
      return { unavailable: true, seatMaps: [] };
    }

    const result: SeatMapResponseDto = {
      unavailable: false,
      seatMaps,
    };

    await this.searchStore.saveSeatMap(dto.searchId, dto.offerId, result);

    return result;
  }

  private collectSegmentContexts(offer: {
    itineraries: Array<{
      segments: Array<{ id: string; flightInstanceId?: string | null }>;
    }>;
  }): SeatMapSegmentContext[] {
    const contexts: SeatMapSegmentContext[] = [];

    for (const itinerary of offer.itineraries) {
      for (const segment of itinerary.segments) {
        if (!segment.flightInstanceId) {
          continue;
        }

        contexts.push({
          segmentId: segment.id,
          flightInstanceId: segment.flightInstanceId,
        });
      }
    }

    return contexts;
  }

  private async loadFlightInstances(
    segmentContexts: SeatMapSegmentContext[],
  ): Promise<SeatMapFlightInstance[]> {
    const instanceIds = [...new Set(segmentContexts.map((context) => context.flightInstanceId))];
    const segmentIds = [...new Set(segmentContexts.map((context) => context.segmentId))];
    const now = new Date();

    return this.prisma.flightInstance.findMany({
      where: {
        id: { in: instanceIds },
      },
      include: {
        ...seatMapInstanceInclude,
        seats: {
          include: {
            seatHolds: {
              where: {
                segmentId: { in: segmentIds },
                expiresAt: {
                  gt: now,
                },
              },
            },
            seatAssignments: {
              where: {
                segmentId: { in: segmentIds },
              },
            },
          },
        },
      },
    });
  }
}
