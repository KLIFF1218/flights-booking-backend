import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PaymentService } from 'src/modules/payment/services/payment.service';
import { Logger } from 'nestjs-pino';
import { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';
import { resolvePaymentProviderFromSnapshot } from '../../utils/snapshot/booking-snapshot.util';
import { assertPaymentProviderCurrencyCompatible } from 'src/shared/currency/payment-defaults.util';
import { BookingStatus, Currency, Prisma } from '@prisma/client';

@Injectable()
export class BookingPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly logger: Logger,
  ) {}
  async createPayment(
    bookingId: string,
    userId: string,
    options?: { afterPaymentPending?: (tx: Prisma.TransactionClient) => Promise<void> },
  ) {
    this.logger.debug({ bookingId, userId }, 'Creating payment for booking');
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.snapshot) {
      throw new BadRequestException('Booking snapshot is missing');
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    const provider = resolvePaymentProviderFromSnapshot(snapshot);
    assertPaymentProviderCurrencyCompatible(provider, booking.currency);

    const payment = await this.paymentService.createPayment({
      bookingId,
      userId,
      amount: Number(booking.totalPrice),
      currency: booking.currency,
      provider,
      afterPaymentPending: options?.afterPaymentPending,
    });
    return payment;
  }

  async resumePayment(bookingId: string, userId: string) {
    this.logger.debug({ bookingId, userId }, 'Resuming payment for booking');
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.snapshot) {
      throw new BadRequestException('Booking snapshot is missing');
    }

    if (booking.status === BookingStatus.PAID || booking.status === BookingStatus.TICKETED) {
      throw new BadRequestException('Booking is already paid');
    }

    if (booking.status === BookingStatus.SEATS_SELECTED) {
      return this.createPaymentWithMeta(bookingId, userId, booking);
    }

    if (booking.status !== BookingStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    const provider = resolvePaymentProviderFromSnapshot(snapshot);
    assertPaymentProviderCurrencyCompatible(provider, booking.currency);

    return this.paymentService.resumePayment({
      bookingId,
      userId,
      amount: Number(booking.totalPrice),
      currency: booking.currency,
      provider,
    });
  }

  private async createPaymentWithMeta(
    bookingId: string,
    userId: string,
    booking: {
      totalPrice: unknown;
      currency: Currency;
      snapshot: unknown;
    },
  ) {
    const snapshot = booking.snapshot as BookingSnapshot;
    const provider = resolvePaymentProviderFromSnapshot(snapshot);
    assertPaymentProviderCurrencyCompatible(provider, booking.currency);

    const payment = await this.paymentService.createPayment({
      bookingId,
      userId,
      amount: Number(booking.totalPrice),
      currency: booking.currency,
      provider,
    });

    const transaction = await this.prisma.transaction.findUnique({
      where: { bookingId },
      select: { id: true, paymentExpiresAt: true },
    });

    if (!transaction?.paymentExpiresAt) {
      throw new BadRequestException('Payment session could not be created');
    }

    return {
      paymentRedirectUrl: payment.redirectUrl,
      transactionId: transaction.id,
      expiresAt: transaction.paymentExpiresAt,
    };
  }

  async cancelPendingPayment(bookingId: string, userId: string): Promise<void> {
    await this.paymentService.rollbackPendingPaymentForBooking(bookingId, userId);
  }
}
