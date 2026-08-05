import { Injectable, BadRequestException } from '@nestjs/common';
import { Currency, SeatType, TravelClass } from '@prisma/client';
import { SeatOption } from '../interfaces/seat-options';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightOffer } from '../interfaces/flight-offers.interface';
import { resolveSeatPriceInCurrency } from 'src/shared/pricing/seat-fee.catalog';

function dedupeSeatOptions(seats: SeatOption[]): SeatOption[] {
  const seen = new Set<string>();
  const unique: SeatOption[] = [];

  for (const seat of seats) {
    const key = `${seat.segmentId}:${seat.seatNumber}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(seat);
  }

  return unique;
}

type ActiveHold = {
  flightSeatId: string;
  segmentId: string;
  bookingId: string;
};

@Injectable()
export class CalculateSeatPrice {
  constructor(private readonly prisma: PrismaService) {}

  async calculateSeatPrice(
    offer: FlightOffer,
    seats: SeatOption[],
    sourceCurrency: Currency,
    targetCurrency: Currency,
    fxRates: Record<string, number>,
    bookingId?: string,
  ) {
    if (!seats.length) {
      return 0;
    }

    const uniqueSeats = dedupeSeatOptions(seats);
    if (uniqueSeats.length !== seats.length) {
      throw new BadRequestException('Duplicate seat selections are not allowed');
    }

    const segmentById = new Map(
      offer.itineraries
        .flatMap((itinerary) => itinerary.segments)
        .map((segment) => [segment.id, segment]),
    );

    for (const selectedSeat of uniqueSeats) {
      if (!segmentById.has(selectedSeat.segmentId)) {
        throw new BadRequestException(`Segment ${selectedSeat.segmentId} not found`);
      }
    }

    const flightInstanceIds = [
      ...new Set(uniqueSeats.map((seat) => segmentById.get(seat.segmentId)!.flightInstanceId)),
    ];
    const seatNumbers = [...new Set(uniqueSeats.map((seat) => seat.seatNumber))];

    const dbSeats = await this.prisma.flightSeat.findMany({
      where: {
        flightInstanceId: { in: flightInstanceIds },
        seatNumber: { in: seatNumbers },
      },
    });

    const seatByKey = new Map(
      dbSeats.map((seat) => [`${seat.flightInstanceId}:${seat.seatNumber}`, seat]),
    );

    const seatIds = dbSeats.map((seat) => seat.id);
    const now = new Date();
    const activeHolds =
      seatIds.length > 0
        ? await this.prisma.seatHold.findMany({
            where: {
              flightSeatId: { in: seatIds },
              expiresAt: { gte: now },
            },
            select: {
              flightSeatId: true,
              segmentId: true,
              bookingId: true,
            },
          })
        : [];

    const holdsBySeatAndSegment = new Map<string, ActiveHold>();
    for (const hold of activeHolds) {
      holdsBySeatAndSegment.set(`${hold.flightSeatId}:${hold.segmentId}`, hold);
    }

    let total = 0;

    for (const selectedSeat of uniqueSeats) {
      const segment = segmentById.get(selectedSeat.segmentId)!;
      const seat = seatByKey.get(`${segment.flightInstanceId}:${selectedSeat.seatNumber}`);

      if (!seat) {
        throw new BadRequestException(`Seat ${selectedSeat.seatNumber} not found`);
      }

      const activeHold = holdsBySeatAndSegment.get(`${seat.id}:${segment.id}`);
      const ownsHold = Boolean(bookingId && activeHold?.bookingId === bookingId);

      if (seat.status !== 'AVAILABLE' && !(seat.status === 'RESERVED' && ownsHold)) {
        throw new BadRequestException(`Seat ${selectedSeat.seatNumber} is not available`);
      }

      if (activeHold && !ownsHold) {
        throw new BadRequestException(
          `Seat ${selectedSeat.seatNumber} is currently held by another transaction`,
        );
      }

      total += resolveSeatPriceInCurrency(
        {
          price: seat.price,
          seatType: seat.seatType ?? SeatType.MIDDLE,
          isExitRow: seat.isExitRow,
          isExtraLegroom: seat.isExtraLegroom,
          isPremium: seat.isPremium,
          travelClass: seat.travelClass,
        },
        sourceCurrency,
        targetCurrency,
        fxRates,
      );
    }

    return total;
  }
}
