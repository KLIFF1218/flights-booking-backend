import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Currency, Prisma, SeatType, TravelClass } from '@prisma/client';

import { FlightsSearchStore } from '../../flights/services/flights-cache.service';
import {
  SeatMapDto,
  SeatMapResponseDto,
  GridCell,
  SeatFeature,
  SingleSegmentSeatMapResponse,
} from '../dtos/seatmap.dto';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { resolveSeatPriceInCurrency } from '../utils/seat-price.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

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
  seats: {
    include: {
      seatHolds: true,
      seatAssignments: true,
    },
  },
} satisfies Prisma.FlightInstanceInclude;

type SeatMapFlightInstance = Prisma.FlightInstanceGetPayload<{
  include: typeof seatMapInstanceInclude;
}>;

type SeatMapSegmentContext = {
  segmentId: string;
  flightInstanceId: string;
};

@Injectable()
export class SeatMapsService {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async getSeatMapByOffer(dto: SeatMapDto): Promise<SeatMapResponseDto> {
    const offer = await this.searchStore.getOffer(dto.searchId, dto.offerId);

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return this.getSeatMap(dto);
  }

  async getSeatMap(dto: SeatMapDto): Promise<SeatMapResponseDto> {
    const offer = await this.searchStore.getOffer(dto.searchId, dto.offerId);

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const targetCurrency = offer.currencyCode ?? offer.price.currency;
    const segmentContexts = this.collectSegmentContexts(offer);

    if (!segmentContexts.length) {
      return { unavailable: true, seatMaps: [] };
    }

    // Prefer quote-locked FX so seatmap minPrice matches pricing/checkout totals.
    const lastPricing = await this.searchStore.getLastPricing(dto.searchId, dto.offerId);
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
        return { unavailable: true, seatMaps: [] };
      }

      seatMaps.push(this.buildSegmentSeatMap(instance, context.segmentId, targetCurrency, fxRates));
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
    const now = new Date();

    return this.prisma.flightInstance.findMany({
      where: {
        id: { in: instanceIds },
      },
      include: {
        aircraft: seatMapInstanceInclude.aircraft,
        fares: seatMapInstanceInclude.fares,
        seats: {
          include: {
            seatHolds: {
              where: {
                expiresAt: {
                  gt: now,
                },
              },
            },
            seatAssignments: true,
          },
        },
      },
    });
  }

  private buildSegmentSeatMap(
    instance: SeatMapFlightInstance,
    segmentId: string,
    targetCurrency: Currency,
    fxRates?: Record<string, number>,
  ): SingleSegmentSeatMapResponse {
    if (!instance.aircraft?.aircraftLayout) {
      throw new ConflictException('Aircraft layout is not configured');
    }

    const sourceCurrency = instance.fares[0]?.currency;
    if (!sourceCurrency) {
      throw new ConflictException('Fare currency is not configured for this flight');
    }

    const layout = instance.aircraft.aircraftLayout;
    const width = layout.width;
    const length = layout.length;

    const grid: GridCell[][] = Array.from({ length }, () =>
      Array.from({ length: width }, () => ({
        type: 'EMPTY' as const,
      })),
    );

    let availableSeatsCount = 0;
    let cabin: TravelClass = TravelClass.ECONOMY;

    for (const seat of instance.seats) {
      if (seat.x < 0 || seat.x >= width || seat.y < 0 || seat.y >= length) {
        throw new ConflictException(
          `Seat ${seat.seatNumber} is out of bounds (${seat.x}, ${seat.y})`,
        );
      }

      if (grid[seat.y][seat.x].type === 'SEAT') {
        throw new ConflictException(
          `Seat collision for ${seat.seatNumber} at coordinates (${seat.x}, ${seat.y})`,
        );
      }

      const hasActiveHold = seat.seatHolds.some((hold) => hold.segmentId === segmentId);
      const isAssigned = seat.seatAssignments.some(
        (assignment) => assignment.segmentId === segmentId,
      );
      const isAvailable = seat.status === 'AVAILABLE' && !hasActiveHold && !isAssigned;

      if (isAvailable) {
        availableSeatsCount++;
      }

      const features: SeatFeature[] = [];

      if (seat.isExitRow) {
        features.push(SeatFeature.EXIT_ROW);
      }

      if (seat.isExtraLegroom) {
        features.push(SeatFeature.EXTRA_LEGROOM);
      }

      if (seat.isPremium) {
        features.push(SeatFeature.PREMIUM);
      }

      const seatClass = seat.travelClass ?? TravelClass.ECONOMY;
      const seatType = seat.seatType ?? SeatType.MIDDLE;

      if (seatClass === TravelClass.FIRST) {
        cabin = TravelClass.FIRST;
      } else if (seatClass === TravelClass.BUSINESS && cabin !== TravelClass.FIRST) {
        cabin = TravelClass.BUSINESS;
      } else if (seatClass === TravelClass.PREMIUM_ECONOMY && cabin === TravelClass.ECONOMY) {
        cabin = TravelClass.PREMIUM_ECONOMY;
      }

      grid[seat.y][seat.x] = {
        type: 'SEAT',
        seatNumber: seat.seatNumber,
        isAvailable,
        minPrice: isAvailable
          ? resolveSeatPriceInCurrency(
              {
                price: seat.price,
                seatType,
                isExitRow: seat.isExitRow,
                isExtraLegroom: seat.isExtraLegroom,
                isPremium: seat.isPremium,
                travelClass: seatClass,
              },
              sourceCurrency,
              targetCurrency,
              fxRates,
            )
          : null,
        seatType,
        deck: seat.deck,
        status: seat.status,
        travelClass: seatClass,
        features,
      };
    }

    for (const facility of layout.facilities) {
      if (facility.x < 0 || facility.x >= width || facility.y < 0 || facility.y >= length) {
        continue;
      }

      if (grid[facility.y][facility.x].type !== 'EMPTY') {
        continue;
      }

      grid[facility.y][facility.x] = {
        type: 'FACILITY',
        code: facility.type,
      };
    }

    const aircraftCode = instance.aircraft?.code ?? 'UNKNOWN';

    runSafely(() => this.metrics.updateSeatsAvailable(availableSeatsCount, aircraftCode));

    return {
      segmentId,
      aircraft: aircraftCode,
      cabin,
      availableSeatsCount,
      grid,
    };
  }
}
