import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  BookingStatus,
  Currency,
  PaymentProvider,
  Prisma,
  type Transaction,
  TransactionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { addMinutes } from 'date-fns';
import { PaymentProviderService } from './payment-provider.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { Logger } from 'nestjs-pino';
import { BookingExpirationService } from '../../bookings/services/booking-expiration.service';
import { PAYMENT_GRACE_MINUTES } from '../../bookings/constants/booking-expiration.constants';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { normalizePaymentFailureReason } from 'src/infra/metrics/normalize-metric-reason.util';
import { PaymentAbandonmentService } from './payment-abandonment.service';
import { PaymentPendingRollbackService } from './payment-pending-rollback.service';
import { canStartCheckoutPayment } from '../domain/payment-booking.policy';
import {
  hasActivePaymentSession,
  isAbandonableTransactionStatus,
} from '../domain/payment-transaction.policy';
import { mergePaymentProviderMeta } from '../types/payment-provider-meta.types';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviderService: PaymentProviderService,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
    private readonly paymentPendingRollback: PaymentPendingRollbackService,
  ) {}

  async createPayment(params: {
    bookingId: string;
    userId: string;
    amount: number;
    currency: Currency;
    provider: PaymentProvider;
    afterPaymentPending?: (tx: Prisma.TransactionClient) => Promise<void>;
  }): Promise<{ redirectUrl: string }> {
    const timer = this.metrics.paymentDuration.startTimer();
    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: params.bookingId, userId: params.userId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      await this.bookingExpirationService.ensureActive(booking);

      if (!canStartCheckoutPayment(booking.status)) {
        this.logger.warn(
          { bookingId: booking.id, status: booking.status },
          'Booking has invalid status for payment',
        );
        throw new BadRequestException('Booking is not payable');
      }

      let transaction: Transaction;
      try {
        transaction = await this.prisma.$transaction(async (tx) => {
          const payableBooking = await tx.booking.findFirst({
            where: {
              id: params.bookingId,
              userId: params.userId,
              status: BookingStatus.SEATS_SELECTED,
            },
          });

          if (!payableBooking) {
            throw new BadRequestException('Booking is not payable');
          }

          const existingTransaction = await tx.transaction.findUnique({
            where: { bookingId: payableBooking.id },
          });

          if (existingTransaction && hasActivePaymentSession(existingTransaction.status)) {
            throw new BadRequestException('Payment already initiated');
          }

          const amount = payableBooking.totalPrice;
          const currency = payableBooking.currency;
          const idempotencyKey = randomUUID();
          const paymentExpiresAt = addMinutes(new Date(), PAYMENT_GRACE_MINUTES);

          const created = existingTransaction
            ? await tx.transaction.update({
                where: { id: existingTransaction.id },
                data: {
                  amount,
                  currency,
                  provider: params.provider,
                  status: TransactionStatus.PENDING,
                  idempotencyKey,
                  paymentExpiresAt,
                  externalId: null,
                  providerMeta: Prisma.JsonNull,
                },
              })
            : await tx.transaction.create({
                data: {
                  bookingId: payableBooking.id,
                  userId: payableBooking.userId,
                  amount,
                  currency,
                  provider: params.provider,
                  status: TransactionStatus.PENDING,
                  idempotencyKey,
                  paymentExpiresAt,
                },
              });

          await tx.booking.update({
            where: { id: payableBooking.id },
            data: {
              status: BookingStatus.PAYMENT_PENDING,
            },
          });

          if (params.afterPaymentPending) {
            await params.afterPaymentPending(tx);
          }

          return created;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new BadRequestException('Payment already initiated');
        }

        throw error;
      }

      let providerSession: { provider: PaymentProvider; externalId: string } | undefined;

      try {
        const payment = await this.paymentProviderService.get({
          transactionId: transaction.id,
          bookingId: booking.id,
          amount: String(transaction.amount),
          currency: transaction.currency,
          idempotencyKey: transaction.idempotencyKey,
          provider: transaction.provider,
        });

        providerSession = {
          provider: transaction.provider,
          externalId: payment.externalId,
        };

        await this.recordPendingProviderSession(
          transaction.id,
          payment.externalId,
          transaction.providerMeta,
        );

        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            externalId: payment.externalId,
            providerMeta: mergePaymentProviderMeta(transaction.providerMeta, {
              pendingProviderSessionId: payment.externalId,
              pendingProviderSessionRecordedAt: new Date().toISOString(),
              ...(payment.meta && typeof payment.meta === 'object'
                ? (payment.meta as Record<string, unknown>)
                : {}),
            }),
          },
        });

        runSafely(() => {
          this.metrics.recordPayment(params.provider, 'initiated');
          this.metrics.recordPaymentValue(
            Math.round(Number(transaction.amount) * 100),
            params.provider,
            'initiated',
          );
          timer({ provider: String(params.provider) });
        });

        return {
          redirectUrl: payment.redirectUrl,
        };
      } catch (providerError) {
        await this.paymentPendingRollback.rollbackPendingPayment(
          booking.id,
          transaction.id,
          providerSession,
        );
        throw providerError;
      }
    } catch (e) {
      const failureReason = normalizePaymentFailureReason(e);
      runSafely(() => {
        this.metrics.recordPaymentFailure(params.provider, failureReason);
        this.metrics.recordPayment(params.provider, 'failure');
        timer({ provider: String(params.provider) });
      });
      throw e;
    }
  }

  async rollbackPendingPaymentForBooking(bookingId: string, userId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        bookingId,
        userId,
        status: TransactionStatus.PENDING,
      },
    });

    if (!transaction) {
      return;
    }

    await this.paymentPendingRollback.rollbackPendingPayment(bookingId, transaction.id);
  }

  async cancelPendingPaymentAtProviderBestEffort(transaction: {
    status: TransactionStatus;
    provider: PaymentProvider;
    externalId: string | null;
    id: string;
  }): Promise<void> {
    return this.paymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort(transaction);
  }

  private async recordPendingProviderSession(
    transactionId: string,
    externalId: string,
    providerMeta: unknown,
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerMeta: mergePaymentProviderMeta(providerMeta, {
          pendingProviderSessionId: externalId,
          pendingProviderSessionRecordedAt: new Date().toISOString(),
        }),
      },
    });
  }

  async resumePayment(params: {
    bookingId: string;
    userId: string;
    amount: number;
    currency: Currency;
    provider: PaymentProvider;
  }): Promise<{ paymentRedirectUrl: string; transactionId: string; expiresAt: Date }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: params.bookingId, userId: params.userId },
      include: { transaction: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.bookingExpirationService.ensureActive(booking);

    if (booking.status !== BookingStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    const transaction = booking.transaction;

    if (!transaction || !isAbandonableTransactionStatus(transaction.status)) {
      throw new BadRequestException('No pending payment found');
    }

    const now = new Date();
    const paymentDeadline = transaction.paymentExpiresAt;

    if (!paymentDeadline || paymentDeadline < now) {
      await this.paymentAbandonmentService.abandonPayment(params.bookingId);
      throw new BadRequestException(
        'Payment window has expired. Please search for flights and book again.',
      );
    }

    if (transaction.externalId) {
      const existingRedirectUrl = await this.paymentProviderService.getPendingPaymentRedirectUrl(
        transaction.provider,
        transaction.externalId,
      );

      if (existingRedirectUrl) {
        return {
          paymentRedirectUrl: existingRedirectUrl,
          transactionId: transaction.id,
          expiresAt: paymentDeadline,
        };
      }
    }

    const payment = await this.recreatePendingPaymentSession(
      params.bookingId,
      transaction,
      paymentDeadline,
    );

    return {
      paymentRedirectUrl: payment.redirectUrl,
      transactionId: transaction.id,
      expiresAt: paymentDeadline,
    };
  }

  private async recreatePendingPaymentSession(
    bookingId: string,
    transaction: Transaction,
    paymentDeadline: Date,
  ): Promise<{ redirectUrl: string }> {
    if (paymentDeadline < new Date()) {
      throw new BadRequestException(
        'Payment window has expired. Please search for flights and book again.',
      );
    }

    if (transaction.externalId) {
      await this.paymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort({
        id: transaction.id,
        status: transaction.status,
        provider: transaction.provider,
        externalId: transaction.externalId,
      });
    }

    const idempotencyKey = randomUUID();

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.PENDING,
        idempotencyKey,
      },
    });

    let providerSession: { provider: PaymentProvider; externalId: string } | undefined;

    try {
      const payment = await this.paymentProviderService.get({
        transactionId: transaction.id,
        bookingId,
        amount: String(transaction.amount),
        currency: transaction.currency,
        idempotencyKey,
        provider: transaction.provider,
      });

      providerSession = {
        provider: transaction.provider,
        externalId: payment.externalId,
      };

      await this.recordPendingProviderSession(
        transaction.id,
        payment.externalId,
        transaction.providerMeta,
      );

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          externalId: payment.externalId,
          providerMeta: mergePaymentProviderMeta(transaction.providerMeta, {
            pendingProviderSessionId: payment.externalId,
            pendingProviderSessionRecordedAt: new Date().toISOString(),
            ...(payment.meta && typeof payment.meta === 'object'
              ? (payment.meta as Record<string, unknown>)
              : {}),
          }),
        },
      });

      return { redirectUrl: payment.redirectUrl };
    } catch (providerError) {
      await this.paymentPendingRollback.rollbackPendingPayment(
        bookingId,
        transaction.id,
        providerSession,
      );
      throw providerError;
    }
  }
}
