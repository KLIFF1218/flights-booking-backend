import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AssignSeatDto } from '../../dtos/booking/add-seats.dto';
import { BookingStatus, Prisma } from '@prisma/client';
import { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';
import { BuiltSegment } from '../../types/segment.types';
import { BookingsCacheService } from '../lifecycle/bookings-cache.service';
import {
  assertBookingStatusAllows,
  BookingOperation,
  getAllowedStatusesForOperation,
} from '../../utils/state/booking-status.guard';
import { BookingExpirationService } from '../lifecycle/booking-expiration.service';
import { SeatReleaseService } from '../seats/seat-release.service';
import { resolveSeatHoldExpiresAt } from '../../utils/seats/seat-hold.util';
import {
  assertSeatSelectionComplete,
  seatAssignmentsMatchRequest,
} from '../../utils/seats/booking-seat-selection.util';
import {
  assertBookingHasStatus,
  updateBookingIfStatus,
} from '../../utils/state/booking-state.util';
import { BookingMetricsService } from '../../metrics/booking-metrics.service';
import { resolveBookingMetricReason } from '../../metrics/booking-metrics.util';

type ResolvedSeatRequest = AssignSeatDto & {
  flightInstanceId: string;
};

@Injectable()
export class BookingSeatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  async assignSeats(bookingId: string, userId: string, seats: AssignSeatDto[]) {
    const startedAt = Date.now();

    try {
      return await this.assignSeatsInternal(bookingId, userId, seats, startedAt);
    } catch (error) {
      this.bookingMetrics.recordSeatAssignmentFailed(resolveBookingMetricReason(error));
      this.bookingMetrics.recordOperationFailed('assign_seats', resolveBookingMetricReason(error));
      throw error;
    }
  }

  private async assignSeatsInternal(
    bookingId: string,
    userId: string,
    seats: AssignSeatDto[],
    startedAt: number,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        travelers: true,
        seatAssignments: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.bookingExpirationService.ensureActive(booking);

    assertBookingStatusAllows(booking.status, BookingOperation.ASSIGN_SEATS);

    if (booking.travelers.length === 0) {
      throw new BadRequestException('Travelers must be added before seat assignment');
    }

    if (!booking.snapshot) {
      throw new BadRequestException('Booking snapshot is missing');
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;

    assertSeatSelectionComplete(snapshot, seats, booking.travelers);

    if (seatAssignmentsMatchRequest(seats, booking.seatAssignments)) {
      await this.refreshSeatHolds(bookingId, booking.expiresAt);
      this.bookingMetrics.recordSeatHoldRefreshed();

      if (booking.status !== BookingStatus.SEATS_SELECTED) {
        await updateBookingIfStatus(
          this.prisma,
          bookingId,
          getAllowedStatusesForOperation(BookingOperation.ASSIGN_SEATS),
          { status: BookingStatus.SEATS_SELECTED },
          userId,
        );
      }

      await this.bookingsCache.invalidateBooking(bookingId, userId);
      this.bookingMetrics.recordSeatAssignment('unchanged');
      this.bookingMetrics.observeSeatAssignmentDuration((Date.now() - startedAt) / 1000);

      return {
        success: true,
        unchanged: true,
      };
    }

    const segmentsById = new Map<string, BuiltSegment>(
      snapshot.offer.itineraries
        .flatMap((itinerary) => itinerary.segments)
        .map((segment) => [segment.id, segment]),
    );

    const travelerIds = new Set(booking.travelers.map((traveler) => traveler.id));
    const assignableStatuses = getAllowedStatusesForOperation(BookingOperation.ASSIGN_SEATS);
    const resolvedSeatRequests = this.resolveSeatRequests(seats, segmentsById, travelerIds);

    await this.prisma.$transaction(
      async (tx) => {
        await assertBookingHasStatus(tx, bookingId, assignableStatuses, userId);

        const currentAssignments = await tx.seatAssignment.findMany({
          where: { bookingId },
          select: { id: true },
        });

        if (currentAssignments.length > 0) {
          await this.seatReleaseService.releaseSeatsForBooking(bookingId, tx, 'reassign');
        }

        const seatByKey = await this.loadRequestedSeats(tx, resolvedSeatRequests);
        const holdExpiresAt = resolveSeatHoldExpiresAt(booking.expiresAt);
        const holdRows: Prisma.SeatHoldCreateManyInput[] = [];
        const assignmentRows: Prisma.SeatAssignmentCreateManyInput[] = [];

        for (const seatRequest of resolvedSeatRequests) {
          const seatKey = `${seatRequest.flightInstanceId}:${seatRequest.seatNumber}`;
          const seat = seatByKey.get(seatKey);

          if (!seat) {
            throw new BadRequestException(`Seat ${seatRequest.seatNumber} not found`);
          }

          const reserved = await tx.flightSeat.updateMany({
            where: {
              id: seat.id,
              status: 'AVAILABLE',
            },
            data: {
              status: 'RESERVED',
            },
          });

          if (reserved.count !== 1) {
            throw new BadRequestException('Seat already reserved');
          }

          holdRows.push({
            bookingId,
            flightSeatId: seat.id,
            segmentId: seatRequest.segmentId,
            travelerId: seatRequest.travelerId,
            expiresAt: holdExpiresAt,
          });

          assignmentRows.push({
            travelerId: seatRequest.travelerId,
            flightSeatId: seat.id,
            segmentId: seatRequest.segmentId,
            bookingId,
          });
        }

        try {
          await tx.seatHold.createMany({ data: holdRows });
          await tx.seatAssignment.createMany({ data: assignmentRows });
        } catch (error: unknown) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new BadRequestException('Seat already reserved');
          }

          throw error;
        }

        await updateBookingIfStatus(
          tx,
          bookingId,
          assignableStatuses,
          { status: BookingStatus.SEATS_SELECTED },
          userId,
        );
      },
      { timeout: 15_000 },
    );

    await this.bookingsCache.invalidateBooking(bookingId, userId);
    this.bookingMetrics.recordSeatAssignment('success');
    this.bookingMetrics.observeSeatAssignmentDuration((Date.now() - startedAt) / 1000);

    return {
      success: true,
      unchanged: false,
    };
  }

  private resolveSeatRequests(
    seats: AssignSeatDto[],
    segmentsById: Map<string, BuiltSegment>,
    travelerIds: Set<string>,
  ): ResolvedSeatRequest[] {
    return seats.map((seatRequest) => {
      if (!travelerIds.has(seatRequest.travelerId)) {
        throw new BadRequestException('Traveler not in booking');
      }

      const segment = segmentsById.get(seatRequest.segmentId);

      if (!segment) {
        throw new BadRequestException('Invalid segment');
      }

      return {
        ...seatRequest,
        flightInstanceId: segment.flightInstanceId,
      };
    });
  }

  private async loadRequestedSeats(
    tx: Prisma.TransactionClient,
    seatRequests: ResolvedSeatRequest[],
  ): Promise<Map<string, { id: string }>> {
    const seats = await tx.flightSeat.findMany({
      where: {
        OR: seatRequests.map((seatRequest) => ({
          flightInstanceId: seatRequest.flightInstanceId,
          seatNumber: seatRequest.seatNumber,
        })),
      },
      select: {
        id: true,
        flightInstanceId: true,
        seatNumber: true,
      },
    });

    return new Map(
      seats.map((seat) => [`${seat.flightInstanceId}:${seat.seatNumber}`, { id: seat.id }]),
    );
  }

  private async refreshSeatHolds(bookingId: string, bookingExpiresAt: Date) {
    await this.prisma.seatHold.updateMany({
      where: { bookingId },
      data: {
        expiresAt: resolveSeatHoldExpiresAt(bookingExpiresAt),
      },
    });
  }
}
