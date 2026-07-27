import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, EnumTransport, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { SeatReleaseService } from './seat-release.service';
import { BookingsCacheService } from './bookings-cache.service';
import { Logger } from 'nestjs-pino';
import { releaseFlightInstanceInventoryForBooking } from '../utils/booking-inventory.util';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import {
  EXPIRABLE_BOOKING_STATUSES,
  EXPIRATION_BATCH_SIZE,
  EXPIRATION_MAX_BATCHES_PER_RUN,
} from '../constants/booking-expiration.constants';
import { runWithConcurrency } from 'src/common/utils/concurrent.util';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';

export { BOOKING_EXPIRATION_MINUTES } from '../constants/booking-expiration.constants';

type BookingExpirationCandidate = {
  id: string;
  userId: string;
  status: BookingStatus;
  expiresAt: Date;
};

@Injectable()
export class BookingExpirationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly outbox: OutboxService,
  ) {}

  async expireStaleBookings(
    now = new Date(),
    batchSize = EXPIRATION_BATCH_SIZE,
    maxBatches = EXPIRATION_MAX_BATCHES_PER_RUN,
  ): Promise<number> {
    const startedAt = Date.now();

    try {
      let totalExpired = 0;

      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const expiredInBatch = await this.expireStaleBookingsBatch(now, batchSize);
        totalExpired += expiredInBatch;

        if (expiredInBatch < batchSize) {
          break;
        }
      }

      this.bookingMetrics.recordMaintenanceRun('expire_bookings', 'success');
      this.bookingMetrics.observeMaintenanceDuration(
        'expire_bookings',
        (Date.now() - startedAt) / 1000,
      );
      this.bookingMetrics.recordMaintenanceItemsProcessed('expire_bookings', totalExpired);

      return totalExpired;
    } catch (error) {
      this.bookingMetrics.recordMaintenanceRun('expire_bookings', 'failure');
      throw error;
    }
  }

  private async expireStaleBookingsBatch(now: Date, batchSize: number): Promise<number> {
    const staleBookings = await this.prisma.booking.findMany({
      where: {
        status: { in: [...EXPIRABLE_BOOKING_STATUSES] },
        expiresAt: { lt: now },
      },
      select: { id: true, userId: true },
      take: batchSize,
    });

    let expiredCount = 0;

    await runWithConcurrency(staleBookings, 10, async (booking) => {
      if (await this.expireBooking(booking.id)) {
        expiredCount += 1;
        await this.bookingsCache.invalidateBooking(booking.id, booking.userId);
      }
    });

    return expiredCount;
  }

  async expireBooking(bookingId: string): Promise<boolean> {
    const expired = await this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { transaction: true },
        });

        if (!booking || !this.shouldExpire(booking)) {
          return false;
        }

        const markedExpired = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: { in: [...EXPIRABLE_BOOKING_STATUSES] },
            expiresAt: { lt: new Date() },
          },
          data: { status: BookingStatus.EXPIRED },
        });

        if (markedExpired.count !== 1) {
          return false;
        }

        await this.seatReleaseService.releaseSeatsForBooking(bookingId, tx, 'expire');

        const snapshot = booking.snapshot as unknown as BookingSnapshot;
        await releaseFlightInstanceInventoryForBooking(tx, bookingId, snapshot);
        this.bookingMetrics.recordInventoryReleased('expire');

        if (
          booking.transaction &&
          (booking.transaction.status === TransactionStatus.PENDING ||
            booking.transaction.status === TransactionStatus.AUTHORIZED)
        ) {
          await tx.transaction.updateMany({
            where: {
              id: booking.transaction.id,
              status: {
                in: [TransactionStatus.PENDING, TransactionStatus.AUTHORIZED],
              },
            },
            data: { status: TransactionStatus.CANCELED },
          });
        }

        const occurredAt = new Date().toISOString();
        await this.outbox.enqueue(tx, {
          aggregateId: bookingId,
          aggregateType: 'Booking',
          topic: 'booking.expired',
          payload: {
            bookingId,
            userId: booking.userId,
            reason: 'ttl_expired',
            occurredAt,
          },
          transport: EnumTransport.KAFKA,
        });

        return true;
      },
      { timeout: 15_000 },
    );

    if (expired) {
      this.logger.log({ bookingId }, 'Booking expired');
      this.bookingMetrics.recordBookingExpired('ttl_expired');
    }

    return expired;
  }

  async ensureActive(booking: BookingExpirationCandidate): Promise<void> {
    if (booking.status === BookingStatus.EXPIRED) {
      throw new BadRequestException('Booking has expired');
    }

    if (!this.shouldExpire(booking)) {
      return;
    }

    await this.expireBooking(booking.id);
    await this.bookingsCache.invalidateBooking(booking.id, booking.userId);
    throw new BadRequestException('Booking has expired');
  }

  async expireIfNeeded(booking: BookingExpirationCandidate): Promise<boolean> {
    if (!this.shouldExpire(booking)) {
      return false;
    }

    const expired = await this.expireBooking(booking.id);
    if (expired) {
      await this.bookingsCache.invalidateBooking(booking.id, booking.userId);
    }

    return expired;
  }

  private shouldExpire(booking: BookingExpirationCandidate): boolean {
    return EXPIRABLE_BOOKING_STATUSES.includes(booking.status) && booking.expiresAt < new Date();
  }
}
