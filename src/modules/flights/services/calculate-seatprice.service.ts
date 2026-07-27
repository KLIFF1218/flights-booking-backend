import { Injectable, BadRequestException } from '@nestjs/common';
import { Currency, SeatType } from '@prisma/client';
import { SeatOption } from '../interfaces/seat-options';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightOffer } from '../interfaces/flight-offers.interface';
import { resolveSeatPriceInCurrency } from 'src/modules/seatmaps/utils/seat-price.util';

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

    let total = 0;

    for (const selectedSeat of uniqueSeats) {
      const segment = offer.itineraries
        .flatMap((i) => i.segments)
        .find((s) => s.id === selectedSeat.segmentId);

      if (!segment) {
        throw new BadRequestException(`Segment ${selectedSeat.segmentId} not found`);
      }

      const seat = await this.prisma.flightSeat.findFirst({
        where: {
          flightInstanceId: segment.flightInstanceId,
          seatNumber: selectedSeat.seatNumber,
        },
      });

      if (!seat) {
        throw new BadRequestException(`Seat ${selectedSeat.seatNumber} not found`);
      }

      const activeHold = await this.prisma.seatHold.findFirst({
        where: {
          flightSeatId: seat.id,
          segmentId: segment.id,
          expiresAt: { gte: new Date() },
        },
      });

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
