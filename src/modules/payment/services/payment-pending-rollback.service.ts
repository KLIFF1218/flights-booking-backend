import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentProvider } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PaymentAbandonmentService } from './payment-abandonment.service';
import { isAbandonableTransactionStatus } from '../domain/payment-transaction.policy';
import { cancelTransactionIfAbandonable } from '../utils/transaction-state.util';

@Injectable()
export class PaymentPendingRollbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentAbandonmentService: PaymentAbandonmentService,
  ) {}

  async rollbackPendingPayment(
    bookingId: string,
    transactionId: string,
    providerSession?: { provider: PaymentProvider; externalId: string },
  ): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || !isAbandonableTransactionStatus(transaction.status)) {
      return;
    }

    const provider = providerSession?.provider ?? transaction.provider;
    const externalId = providerSession?.externalId ?? transaction.externalId;

    const rolledBack = await this.prisma.$transaction(async (tx) => {
      const canceled = await cancelTransactionIfAbandonable(tx, transactionId);
      if (!canceled) {
        return false;
      }

      await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: BookingStatus.PAYMENT_PENDING,
        },
        data: { status: BookingStatus.SEATS_SELECTED },
      });

      return true;
    });

    if (rolledBack && externalId) {
      await this.paymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort({
        id: transactionId,
        status: transaction.status,
        provider,
        externalId,
      });
    }
  }
}
