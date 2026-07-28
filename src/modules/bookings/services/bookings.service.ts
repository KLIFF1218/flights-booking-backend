import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingStatus, EnumTransport, TransactionStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { BookingsCacheService } from './bookings-cache.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { mapToListItem } from '../mappers/booking-list.mapper';
import { canAccessBookingTickets } from '../utils/booking-ticket-access.util';
import { bookingListItemSelect } from '../types/booking-list-item';
import { SeatReleaseService } from './seat-release.service';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { UserBookingsQueryDto } from '../dtos/user-bookings-query.dto';
import { UserBookingsListDto } from '../dtos/user-bookings-list.dto';
import {
  USER_CANCELLABLE_BOOKING_STATUSES,
  USER_NON_CANCELLABLE_BOOKING_STATUSES,
} from '../constants/booking-cancel.constants';
import { PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC } from '../constants/booking-outbox.constants';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import { releaseFlightInstanceInventoryForBooking } from '../utils/booking-inventory.util';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly bookingsCache: BookingsCacheService,
    private readonly outbox: OutboxService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}
  async findAllByUser(
    userId: string,
    query: UserBookingsQueryDto = {},
  ): Promise<UserBookingsListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const cached = await this.bookingsCache.getUserBookingsList(userId, page, limit);
    if (cached) {
      this.bookingMetrics.recordCacheHit('user_list');
      return cached;
    }

    this.bookingMetrics.recordCacheMiss('user_list');

    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: { userId },
        select: bookingListItemSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);

    const mappedBookings = bookings.map((booking) => {
      const mapped = mapToListItem(booking);

      if (canAccessBookingTickets(booking.status) && booking.tickets.length > 0) {
        mapped.tickets = booking.tickets.map((ticket) => ({
          id: ticket.id,
          travelerId: ticket.travelerId,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
        }));
      }

      return mapped;
    });

    const result: UserBookingsListDto = {
      bookings: mappedBookings,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };

    await this.bookingsCache.saveUserBookingsList(userId, page, limit, result);

    return result;
  }

  async compensateFailedCreateBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { status: true },
    });

    if (!booking) {
      return null;
    }

    if (booking.status === BookingStatus.CANCELED || booking.status === BookingStatus.EXPIRED) {
      return booking;
    }

    return this.cancel(bookingId, userId);
  }

  async cancel(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { transaction: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELED) {
      return booking;
    }

    if (USER_NON_CANCELLABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Cancellation is not possible');
    }

    if (!USER_CANCELLABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Cancellation is not possible');
    }

    const pendingTransaction =
      booking.transaction?.status === TransactionStatus.PENDING ? booking.transaction : null;

    const canceledPayload = {
      bookingId,
      userId,
      reason: 'user_canceled',
      occurredAt: new Date().toISOString(),
    };

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      if (pendingTransaction) {
        const canceledTransaction = await tx.transaction.updateMany({
          where: {
            id: pendingTransaction.id,
            status: TransactionStatus.PENDING,
          },
          data: { status: TransactionStatus.CANCELED },
        });

        if (canceledTransaction.count === 0) {
          const currentTransaction = await tx.transaction.findUnique({
            where: { id: pendingTransaction.id },
            select: { status: true },
          });

          if (currentTransaction?.status === TransactionStatus.SUCCEED) {
            throw new BadRequestException('Cancellation is not possible');
          }
        }
      }

      const canceled = await tx.booking.updateMany({
        where: {
          id: bookingId,
          userId,
          status: { in: [...USER_CANCELLABLE_BOOKING_STATUSES] },
        },
        data: { status: BookingStatus.CANCELED },
      });

      if (canceled.count === 0) {
        throw new BadRequestException('Cancellation is not possible');
      }

      await this.seatReleaseService.releaseSeatsForBooking(bookingId, tx, 'cancel');

      const snapshot = booking.snapshot as unknown as BookingSnapshot;
      await releaseFlightInstanceInventoryForBooking(tx, bookingId, snapshot);
      this.bookingMetrics.recordInventoryReleased('cancel');

      const canceledBooking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { transaction: true },
      });

      await this.outbox.enqueue(tx, {
        aggregateId: bookingId,
        aggregateType: 'Booking',
        topic: 'booking.canceled',
        payload: canceledPayload,
        transport: EnumTransport.KAFKA,
      });

      if (pendingTransaction) {
        await this.outbox.enqueue(tx, {
          aggregateId: bookingId,
          aggregateType: 'Booking',
          topic: PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC,
          payload: {
            transactionId: pendingTransaction.id,
            provider: pendingTransaction.provider,
            externalId: pendingTransaction.externalId,
          },
          transport: EnumTransport.INTERNAL,
        });
      }

      return canceledBooking;
    });

    await this.bookingsCache.invalidateBooking(bookingId, booking.userId);

    const snapshot = booking.snapshot as unknown as BookingSnapshot | null;
    const airlineCode = snapshot?.offer?.itineraries?.[0]?.segments?.[0]?.carrierCode ?? 'unknown';

    this.bookingMetrics.recordBookingCanceled('user_canceled', booking.status, airlineCode);

    return updatedBooking;
  }
}
