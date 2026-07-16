import { BadRequestException, Injectable } from '@nestjs/common';
import { SeatOption } from '../interfaces/seat-options';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightOffer } from '../interfaces/flight-offers.interface';

@Injectable()
export class CalculateSeatPrice {
  constructor(private readonly prisma: PrismaService) {}
  async calculateSeatPrice(offer: FlightOffer, seats: SeatOption[]) {
    if (!seats.length) {
      return 0;
    }

    let total = 0;

    for (const selectedSeat of seats) {
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

      if (seat.status !== 'AVAILABLE') {
        throw new BadRequestException(`Seat ${selectedSeat.seatNumber} is not available`);
      }

      const activeHold = await this.prisma.seatHold.findFirst({
        where: {
          flightSeatId: seat.id,
          segmentId: segment.id,
          expiresAt: { gte: new Date() },
        },
      });

      if (activeHold) {
        throw new BadRequestException(
          `Seat ${selectedSeat.seatNumber} is currently held by another transaction`,
        );
      }

      total += Number(seat.price);
    }

    return total;
  }
}
