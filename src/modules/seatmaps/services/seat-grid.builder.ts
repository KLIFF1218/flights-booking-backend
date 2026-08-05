import { ConflictException } from '@nestjs/common';
import { type Currency, type SeatStatus, SeatType, TravelClass } from '@prisma/client';
import { resolveSeatPriceInCurrency } from 'src/shared/pricing/seat-fee.catalog';
import { type GridCell, SeatFeature, type SingleSegmentSeatMapResponse } from '../dtos/seatmap.dto';
import { isSeatAvailableForSegment } from '../domain/seat-availability.policy';

const UNKNOWN_AIRCRAFT_CODE = 'UNKNOWN';

export type SegmentSeatMapInstance = {
  aircraft: {
    code: string;
    aircraftLayout: {
      width: number;
      length: number;
      facilities: Array<{ x: number; y: number; type: string }>;
    } | null;
  } | null;
  fares: Array<{ currency: Currency }>;
  seats: Array<{
    seatNumber: string;
    x: number;
    y: number;
    status: SeatStatus;
    seatType: SeatType | null;
    deck: number;
    price: unknown;
    isExitRow: boolean;
    isExtraLegroom: boolean;
    isPremium: boolean;
    travelClass: TravelClass | null;
    seatHolds: Array<{ segmentId: string }>;
    seatAssignments: Array<{ segmentId: string }>;
  }>;
};

export function buildSegmentSeatMap(
  instance: SegmentSeatMapInstance,
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

    const isAvailable = isSeatAvailableForSegment(seat, segmentId);

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

  const aircraftCode = instance.aircraft?.code ?? UNKNOWN_AIRCRAFT_CODE;

  return {
    segmentId,
    aircraft: aircraftCode,
    cabin,
    availableSeatsCount,
    grid,
  };
}
