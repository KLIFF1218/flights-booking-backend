import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, SeatStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { resolveSeatHoldExpiresAt } from '../utils/seat-hold.util';
import {
  RELEASE_EXPIRED_HOLDS_BATCH_SIZE,
  RELEASE_EXPIRED_HOLDS_MAX_BATCHES_PER_RUN,
} from '../constants/seat-hold.constants';
import { runWithConcurrency } from 'src/common/utils/concurrent.util';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

type ExpiredSeatHold = {
  id: string;
  bookingId: string;
  flightSeatId: string;
  travelerId: string;
  segmentId: string;
  createdAt: Date;
};

@Injectable()
export class SeatReleaseService {
  private static readonly PAID_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatus.PAID,
    BookingStatus.TICKETING,
    BookingStatus.TICKETED,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly metrics: MetricsService,
  ) {}

  async releaseSeatsForBooking(
    bookingId: string,
    tx: Prisma.TransactionClient,
    reason = 'release',
  ): Promise<void> {
    await tx.seatHold.deleteMany({ where: { bookingId } });

    const assignments = await tx.seatAssignment.findMany({
      where: { bookingId },
      select: { flightSeatId: true },
    });

    const seatIds = assignments.map((assignment) => assignment.flightSeatId);

    if (seatIds.length > 0) {
      await tx.flightSeat.updateMany({
        where: { id: { in: seatIds }, status: SeatStatus.RESERVED },
        data: { status: SeatStatus.AVAILABLE },
      });
    }

    await tx.seatAssignment.deleteMany({ where: { bookingId } });
    this.bookingMetrics.recordSeatRelease(reason);
  }

  async confirmSeatsForPaidBooking(bookingId: string, tx: Prisma.TransactionClient): Promise<void> {
    const assignments = await tx.seatAssignment.findMany({
      where: { bookingId },
      select: { flightSeatId: true },
    });

    const seatIds = assignments.map((assignment) => assignment.flightSeatId);

    if (seatIds.length > 0) {
      await tx.flightSeat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: SeatStatus.BOOKED },
      });
    }

    await tx.seatHold.deleteMany({ where: { bookingId } });
  }

  async revertCheckoutPreparation(bookingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });

      if (
        !booking ||
        (booking.status !== BookingStatus.SEATS_SELECTED &&
          booking.status !== BookingStatus.PAYMENT_PENDING)
      ) {
        return;
      }

      await this.releaseSeatsForBooking(bookingId, tx, 'checkout_rollback');

      await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: {
            in: [BookingStatus.SEATS_SELECTED, BookingStatus.PAYMENT_PENDING],
          },
        },
        data: { status: BookingStatus.PNR_CREATED },
      });
    });
  }

  async releaseExpiredHolds(
    now = new Date(),
    batchSize = RELEASE_EXPIRED_HOLDS_BATCH_SIZE,
    maxBatches = RELEASE_EXPIRED_HOLDS_MAX_BATCHES_PER_RUN,
  ): Promise<number> {
    const startedAt = Date.now();

    try {
      let totalReleased = 0;

      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const releasedInBatch = await this.releaseExpiredHoldsBatch(now, batchSize);
        totalReleased += releasedInBatch;

        if (releasedInBatch === 0) {
          break;
        }
      }

      this.bookingMetrics.recordMaintenanceRun('release_expired_holds', 'success');
      this.bookingMetrics.observeMaintenanceDuration(
        'release_expired_holds',
        (Date.now() - startedAt) / 1000,
      );
      this.bookingMetrics.recordMaintenanceItemsProcessed('release_expired_holds', totalReleased);

      return totalReleased;
    } catch (error) {
      this.bookingMetrics.recordMaintenanceRun('release_expired_holds', 'failure');
      throw error;
    }
  }

  private async releaseExpiredHoldsBatch(now: Date, batchSize: number): Promise<number> {
    const expiredHolds = await this.prisma.seatHold.findMany({
      where: { expiresAt: { lt: now } },
      orderBy: { expiresAt: 'asc' },
      select: {
        id: true,
        bookingId: true,
        flightSeatId: true,
        travelerId: true,
        segmentId: true,
        createdAt: true,
      },
      take: batchSize,
    });

    if (expiredHolds.length === 0) {
      return 0;
    }

    const holdsByBooking = new Map<string, ExpiredSeatHold[]>();

    for (const hold of expiredHolds) {
      const group = holdsByBooking.get(hold.bookingId) ?? [];
      group.push(hold);
      holdsByBooking.set(hold.bookingId, group);
    }

    let releasedCount = 0;

    await runWithConcurrency([...holdsByBooking.entries()], 10, async ([bookingId, holds]) => {
      for (const hold of holds) {
        runSafely(() =>
          this.metrics.recordSeatHoldDuration(
            Math.max(0, (now.getTime() - hold.createdAt.getTime()) / 1000),
            'expired',
          ),
        );
      }
      releasedCount += await this.releaseExpiredHoldsForBooking(bookingId, holds, now);
    });

    return releasedCount;
  }

  private async releaseExpiredHoldsForBooking(
    bookingId: string,
    holds: ExpiredSeatHold[],
    now: Date,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { transaction: true },
      });

      if (!booking || this.shouldSkipExpiredHoldRelease(booking)) {
        return 0;
      }

      // Fully expired bookings are handled by BookingExpirationService (EXPIRED + seat release).
      if (booking.expiresAt <= now) {
        return 0;
      }

      // Hold TTL drifted while the booking is still active — resync instead of releasing seats.
      const holdIds = holds.map((hold) => hold.id);

      await tx.seatHold.updateMany({
        where: { id: { in: holdIds }, expiresAt: { lt: now } },
        data: { expiresAt: resolveSeatHoldExpiresAt(booking.expiresAt) },
      });

      return 0;
    });
  }

  private shouldSkipExpiredHoldRelease(booking: {
    status: BookingStatus;
    transaction: { status: TransactionStatus } | null;
  }): boolean {
    if (SeatReleaseService.PAID_BOOKING_STATUSES.includes(booking.status)) {
      return true;
    }

    if (booking.transaction?.status === TransactionStatus.SUCCEED) {
      return true;
    }

    if (
      booking.status === BookingStatus.PAYMENT_PENDING &&
      booking.transaction?.status === TransactionStatus.PENDING
    ) {
      return true;
    }

    return false;
  }
}
