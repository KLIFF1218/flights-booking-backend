import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AssignSeatDto } from '../dtos/add-seats.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingSeatService {
  constructor(private readonly prisma: PrismaService) {}
  async assignSeats(bookingId: string, userId: string, seats: AssignSeatDto[]) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        travelers: true,
        flightInstance: {
          include: {
            flight: {
              include: {
                segments: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const travelerIds = booking.travelers.map((t) => t.id);

    if (!booking.flightInstance) {
      throw new NotFoundException('Flight instance not found in booking');
    }

    const segmentIds = booking.flightInstance.flight.segments.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      for (const seatRequest of seats) {
        if (!travelerIds.includes(seatRequest.travelerId)) {
          throw new BadRequestException('Traveler not in booking');
        }

        if (!segmentIds.includes(seatRequest.segmentId)) {
          throw new BadRequestException('Invalid segment');
        }

        const seat = await tx.flightSeat.findFirst({
          where: {
            flightInstanceId: booking.flightInstanceId!,
            seatNumber: seatRequest.seatNumber,
            status: 'AVAILABLE',
          },
        });

        if (!seat) {
          throw new BadRequestException(`Seat ${seatRequest.seatNumber} not found`);
        }

        try {
          await tx.seatHold.create({
            data: {
              bookingId,
              flightSeatId: seat.id,
              segmentId: seatRequest.segmentId,
              travelerId: seatRequest.travelerId,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            throw new BadRequestException('Seat already reserved');
          }

          throw e;
        }

        await tx.seatAssignment.upsert({
          where: {
            travelerId_segmentId: {
              travelerId: seatRequest.travelerId,
              segmentId: seatRequest.segmentId,
            },
          },
          update: {
            flightSeatId: seat.id,
          },
          create: {
            travelerId: seatRequest.travelerId,
            flightSeatId: seat.id,
            segmentId: seatRequest.segmentId,
            bookingId,
          },
        });

        await tx.flightSeat.update({
          where: {
            id: seat.id,
          },
          data: {
            status: 'RESERVED',
          },
        });

        await tx.booking.update({
          where: {
            id: bookingId,
          },
          data: {
            status: BookingStatus.SEATS_SELECTED,
          },
        });
      }
    });

    return {
      success: true,
    };
  }
}
