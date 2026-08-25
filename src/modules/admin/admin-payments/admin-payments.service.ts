import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, EnumTransport, PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentStatusEnum } from 'nestjs-yookassa';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { YookassaProvider } from 'src/modules/payment/providers/yoomoney/yoomoney.service';
import { BookingsCacheService } from 'src/modules/bookings/services/lifecycle/bookings-cache.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { SeatReleaseService } from 'src/modules/bookings/services/seats/seat-release.service';
import { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import { releaseFlightInstanceInventoryForBooking } from 'src/modules/bookings/utils/inventory/booking-inventory.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import {
  cancelTransactionIfAbandonable,
  finalizeTransactionToSucceed,
} from 'src/modules/payment/utils/transaction-state.util';

const ADMIN_PAYABLE_BOOKING_STATUSES: readonly BookingStatus[] = [BookingStatus.PAYMENT_PENDING];

const ADMIN_CONFIRMABLE_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.AUTHORIZED,
];

const ADMIN_CANCELABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.SEATS_SELECTED,
  BookingStatus.PNR_CREATED,
];

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly yookassa: YookassaProvider,
    private readonly bookingsCache: BookingsCacheService,
    private readonly outbox: OutboxService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly metrics: MetricsService,
  ) {}

  async confirm(transactionId: string) {
    try {
      const result = await this.confirmInternal(transactionId);
      runSafely(() => this.metrics.recordAdminAction('payment_confirm', 'success'));
      return result;
    } catch (error) {
      runSafely(() => this.metrics.recordAdminAction('payment_confirm', 'failure'));
      throw error;
    }
  }

  private async confirmInternal(transactionId: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
      include: { booking: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.assertYookassaTransaction(transaction.provider);

    if (transaction.status === TransactionStatus.SUCCEED) {
      return { success: true };
    }

    if (!ADMIN_CONFIRMABLE_TRANSACTION_STATUSES.includes(transaction.status)) {
      throw new BadRequestException('Transaction is not pending or authorized');
    }

    if (!ADMIN_PAYABLE_BOOKING_STATUSES.includes(transaction.booking.status)) {
      throw new BadRequestException('Booking is not payable');
    }

    if (!transaction.externalId) {
      throw new BadRequestException('Payment external id is missing');
    }

    const payment = await this.yookassa.getPayment(transaction.externalId);

    if (payment.status === PaymentStatusEnum.CANCELED) {
      throw new BadRequestException('Payment already canceled');
    }

    if (payment.status === PaymentStatusEnum.WAITING_FOR_CAPTURE) {
      await this.yookassa.capturePayment(transaction.externalId);
    } else if (payment.status !== PaymentStatusEnum.SUCCEEDED) {
      throw new BadRequestException(
        `Payment cannot be captured. Current status: ${payment.status}`,
      );
    }

    const occurredAt = new Date().toISOString();

    await this.prismaService.$transaction(async (tx) => {
      const finalized = await finalizeTransactionToSucceed(tx, transactionId, {});

      if (!finalized) {
        throw new BadRequestException('Transaction is not pending or authorized');
      }

      const markedPaid = await tx.booking.updateMany({
        where: {
          id: transaction.bookingId,
          status: BookingStatus.PAYMENT_PENDING,
        },
        data: { status: BookingStatus.PAID },
      });

      if (markedPaid.count !== 1) {
        throw new BadRequestException('Booking is not payable');
      }

      const seats = await tx.seatAssignment.findMany({
        where: { bookingId: transaction.bookingId },
        select: { flightSeatId: true },
      });

      const seatIds = seats.map((seat) => seat.flightSeatId);

      if (seatIds.length > 0) {
        await tx.flightSeat.updateMany({
          where: { id: { in: seatIds } },
          data: { status: 'BOOKED' },
        });
      }

      await tx.seatHold.deleteMany({
        where: { bookingId: transaction.bookingId },
      });

      await this.outbox.enqueue(tx, {
        aggregateId: transaction.bookingId,
        aggregateType: 'Booking',
        topic: `${process.env.RABBITMQ_EXCHANGE || 'booking.events'}:booking.paid`,
        payload: {
          bookingId: transaction.bookingId,
          occurredAt,
        },
        transport: EnumTransport.RABBITMQ,
      });

      await this.outbox.enqueue(tx, {
        aggregateId: transaction.bookingId,
        aggregateType: 'Booking',
        topic: 'booking.paid',
        payload: {
          bookingId: transaction.bookingId,
          occurredAt,
        },
        transport: EnumTransport.KAFKA,
      });
    });

    await this.bookingsCache.invalidateBooking(transaction.bookingId, transaction.userId);

    return { success: true };
  }

  async cancel(transactionId: string) {
    try {
      const result = await this.cancelInternal(transactionId);
      runSafely(() => this.metrics.recordAdminAction('payment_cancel', 'success'));
      return result;
    } catch (error) {
      runSafely(() => this.metrics.recordAdminAction('payment_cancel', 'failure'));
      throw error;
    }
  }

  private async cancelInternal(transactionId: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
      include: { booking: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.assertYookassaTransaction(transaction.provider);

    if (transaction.status === TransactionStatus.CANCELED) {
      return { success: true };
    }

    if (transaction.status === TransactionStatus.SUCCEED) {
      throw new BadRequestException('Succeeded transaction cannot be canceled');
    }

    if (!ADMIN_CANCELABLE_BOOKING_STATUSES.includes(transaction.booking.status)) {
      throw new BadRequestException('Booking cannot be canceled');
    }

    if (!transaction.externalId) {
      throw new BadRequestException('Payment external id is missing');
    }

    const payment = await this.yookassa.getPayment(transaction.externalId);

    if (
      payment.status === PaymentStatusEnum.PENDING ||
      payment.status === PaymentStatusEnum.WAITING_FOR_CAPTURE
    ) {
      await this.yookassa.cancelPendingPaymentIfNeeded(transaction.externalId);
    }

    if (payment.status === PaymentStatusEnum.SUCCEEDED) {
      await this.yookassa.refundPayment(transaction.externalId);
    }

    const occurredAt = new Date().toISOString();

    await this.prismaService.$transaction(async (tx) => {
      const finalized = await cancelTransactionIfAbandonable(tx, transactionId);

      if (!finalized) {
        throw new BadRequestException('Transaction cannot be canceled');
      }

      const canceled = await tx.booking.updateMany({
        where: {
          id: transaction.bookingId,
          status: { in: [...ADMIN_CANCELABLE_BOOKING_STATUSES] },
        },
        data: { status: BookingStatus.CANCELED },
      });

      if (canceled.count !== 1) {
        throw new BadRequestException('Booking cannot be canceled');
      }

      await this.seatReleaseService.releaseSeatsForBooking(transaction.bookingId, tx);

      const snapshot = transaction.booking.snapshot as unknown as BookingSnapshot;
      await releaseFlightInstanceInventoryForBooking(tx, transaction.bookingId, snapshot);

      await this.outbox.enqueue(tx, {
        aggregateId: transaction.bookingId,
        aggregateType: 'Booking',
        topic: 'payment.failed',
        payload: {
          bookingId: transaction.bookingId,
          userId: transaction.userId,
          transactionId: transaction.id,
          reason: 'admin_canceled',
          occurredAt,
        },
        transport: EnumTransport.KAFKA,
      });
    });

    await this.bookingsCache.invalidateBooking(transaction.bookingId, transaction.userId);

    return { success: true };
  }

  private assertYookassaTransaction(provider: PaymentProvider): void {
    if (provider !== PaymentProvider.YOOKASSA) {
      throw new BadRequestException('Only YooKassa transactions are supported by this endpoint');
    }
  }
}
