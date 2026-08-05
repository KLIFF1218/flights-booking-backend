import { Injectable } from '@nestjs/common';
import { EnumTransport, type Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { SeatReleaseService } from './seat-release.service';
import { BookingsCacheService } from './bookings-cache.service';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import { releaseFlightInstanceInventoryForBooking } from '../utils/booking-inventory.util';
import {
  markBookingCanceledIfPaymentPending,
  markBookingExpiredIfPaymentPending,
  markBookingPaidIfPending,
} from '../utils/booking-payment-state.util';
import {
  BOOKING_PAYMENT_SEAT_RELEASE_REASON,
  type BookingPaymentSeatReleaseReason,
} from '../constants/booking-seat-lifecycle.constants';
import {
  BOOKING_PAID_OUTBOX_TOPIC,
  buildBookingPaidRabbitOutboxTopic,
} from '../constants/booking-paid-outbox.constants';

@Injectable()
export class BookingPaymentLifecycleService {
  constructor(
    private readonly outbox: OutboxService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly logger: Logger,
  ) {}

  async confirmPaid(
    tx: Prisma.TransactionClient,
    bookingId: string,
    occurredAt: string,
  ): Promise<boolean> {
    const markedPaid = await markBookingPaidIfPending(tx, bookingId);
    if (!markedPaid) {
      return false;
    }

    await this.seatReleaseService.confirmSeatsForPaidBooking(bookingId, tx);
    await this.enqueueBookingPaidEvents(tx, bookingId, occurredAt);

    this.logger.log({ bookingId }, 'Booking marked as PAID');

    return true;
  }

  async cancelUnpaid(
    tx: Prisma.TransactionClient,
    bookingId: string,
    snapshot: unknown,
    seatReleaseReason: BookingPaymentSeatReleaseReason = BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_FAILED,
    inventoryMetricReason = seatReleaseReason,
  ): Promise<boolean> {
    const canceled = await markBookingCanceledIfPaymentPending(tx, bookingId);
    if (!canceled) {
      return false;
    }

    await this.releaseSeatsAndInventory(
      tx,
      bookingId,
      snapshot,
      seatReleaseReason,
      inventoryMetricReason,
    );

    return true;
  }

  async expireUnpaidPaymentPending(
    tx: Prisma.TransactionClient,
    bookingId: string,
    snapshot: unknown,
  ): Promise<boolean> {
    const expired = await markBookingExpiredIfPaymentPending(tx, bookingId);
    if (!expired) {
      return false;
    }

    await this.releaseSeatsAndInventory(
      tx,
      bookingId,
      snapshot,
      BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_ABANDONED,
      BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_ABANDONED,
    );

    this.bookingMetrics.recordBookingExpired(BOOKING_PAYMENT_SEAT_RELEASE_REASON.PAYMENT_ABANDONED);

    return true;
  }

  async releaseSeatsAndInventoryForTicketingFailure(
    tx: Prisma.TransactionClient,
    bookingId: string,
    snapshot: unknown,
  ): Promise<void> {
    await this.releaseSeatsAndInventory(
      tx,
      bookingId,
      snapshot,
      BOOKING_PAYMENT_SEAT_RELEASE_REASON.TICKETING_FAILED,
      BOOKING_PAYMENT_SEAT_RELEASE_REASON.TICKETING_FAILED,
    );
  }

  async invalidateBooking(bookingId: string, userId: string): Promise<void> {
    await this.bookingsCache.invalidateBooking(bookingId, userId);
  }

  private async releaseSeatsAndInventory(
    tx: Prisma.TransactionClient,
    bookingId: string,
    snapshot: unknown,
    seatReleaseReason: string,
    inventoryMetricReason: string,
  ): Promise<void> {
    await this.seatReleaseService.releaseSeatsForBooking(bookingId, tx, seatReleaseReason);

    const bookingSnapshot = snapshot as BookingSnapshot;
    if (bookingSnapshot) {
      await releaseFlightInstanceInventoryForBooking(tx, bookingId, bookingSnapshot);
    }

    this.bookingMetrics.recordInventoryReleased(inventoryMetricReason);
  }

  private async enqueueBookingPaidEvents(
    tx: Prisma.TransactionClient,
    bookingId: string,
    occurredAt: string,
  ): Promise<void> {
    await this.outbox.enqueue(tx, {
      aggregateId: bookingId,
      aggregateType: 'Booking',
      topic: buildBookingPaidRabbitOutboxTopic(),
      payload: {
        bookingId,
        occurredAt,
      },
      transport: EnumTransport.RABBITMQ,
    });

    await this.outbox.enqueue(tx, {
      aggregateId: bookingId,
      aggregateType: 'Booking',
      topic: BOOKING_PAID_OUTBOX_TOPIC,
      payload: {
        bookingId,
        occurredAt,
      },
      transport: EnumTransport.KAFKA,
    });
  }
}
