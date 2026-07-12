import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { TransactionStatus } from '@prisma/client';
import { PaymentStatusEnum } from 'nestjs-yookassa';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { YookassaProvider } from 'src/modules/payment/providers/yoomoney/yoomoney.service';

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly yookassa: YookassaProvider,
  ) {}

  async confirm(transactionId: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const payment = await this.yookassa.getPayment(transaction.externalId!);

    if (payment.status === PaymentStatusEnum.CANCELED) {
      throw new BadRequestException('Payment already canceled');
    }

    if (payment.status !== PaymentStatusEnum.WAITING_FOR_CAPTURE) {
      throw new BadRequestException(
        `Payment cannot be captured. Current status: ${payment.status}`,
      );
    }

    await this.yookassa.capturePayment(transaction.externalId!);

    await this.prismaService.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.SUCCEED },
    });

    await this.prismaService.booking.update({
      where: { id: transaction.bookingId },
      data: { status: BookingStatus.PAID },
    });

    return { success: true };
  }

  async cancel(transactionId: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
      include: { booking: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const payment = await this.yookassa.getPayment(transaction.externalId!);

    if (
      payment.status === PaymentStatusEnum.PENDING ||
      payment.status === PaymentStatusEnum.WAITING_FOR_CAPTURE
    ) {
      await this.yookassa.cancelPayment(transaction.externalId!);
    }

    if (payment.status === PaymentStatusEnum.SUCCEEDED) {
      await this.yookassa.refundPayment(transaction.externalId!);
    }

    await this.prismaService.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.CANCELED },
    });

    await this.prismaService.booking.update({
      where: { id: transaction.bookingId },
      data: { status: BookingStatus.CANCELED },
    });

    return { success: true };
  }
}
