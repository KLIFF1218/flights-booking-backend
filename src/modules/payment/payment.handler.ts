import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { PaymentWebhookResult } from './interfaces/payment-webhook-result.dto';
import { Logger } from 'nestjs-pino';
import { BookingEventsPublisher } from 'src/infra/rabbitmq/booking-events.publisher';
import { KafkaPublisher } from 'src/infra/kafka/kafka.publisher';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { EnumTransport } from '@prisma/client';

@Injectable()
export class PaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly bookingEventsPublisher: BookingEventsPublisher,
    private readonly kafka: KafkaPublisher,
    private readonly outbox: OutboxService,
  ) {}

  async processResult(result: PaymentWebhookResult): Promise<void> {
    const { transactionId, status, paymentId } = result;

    let bookingIdToTicket: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { booking: true },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (
        transaction.status === TransactionStatus.SUCCEED ||
        transaction.status === TransactionStatus.CANCELED
      ) {
        this.logger.warn(
          { transactionId, status: transaction.status },
          'Transaction already finalized',
        );
        return;
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status,
          externalId: paymentId,
        },
      });

      if (status === TransactionStatus.SUCCEED) {
        await tx.booking.update({
          where: { id: transaction.bookingId },
          data: { status: BookingStatus.PAID },
        });

        const seats = await tx.seatAssignment.findMany({
          where: { bookingId: transaction.bookingId },
          select: { flightSeatId: true },
        });

        const seatIds = seats.map((s) => s.flightSeatId);

        await tx.flightSeat.updateMany({
          where: {
            id: { in: seatIds },
          },
          data: {
            status: 'BOOKED',
          },
        });

        await tx.flightInstance.update({
          where: {
            id: transaction.booking.flightInstanceId!,
          },
          data: {
            seatsAvailable: {
              decrement: seatIds.length,
            },
          },
        });

        await tx.seatHold.deleteMany({
          where: {
            bookingId: transaction.bookingId,
          },
        });

        bookingIdToTicket = transaction.bookingId;

        this.logger.log({ bookingId: transaction.bookingId }, 'Booking marked as PAID');
      }

      if (status === TransactionStatus.CANCELED) {
        await tx.booking.update({
          where: { id: transaction.bookingId },
          data: { status: BookingStatus.CANCELED },
        });

        await tx.seatHold.deleteMany({
          where: {
            bookingId: transaction.bookingId,
          },
        });

        const seats = await tx.seatAssignment.findMany({
          where: {
            bookingId: transaction.bookingId,
          },
          select: {
            flightSeatId: true,
          },
        });

        const seatIds = seats.map((s) => s.flightSeatId);

        await tx.flightSeat.updateMany({
          where: {
            id: { in: seatIds },
          },
          data: {
            status: 'AVAILABLE',
          },
        });

        await tx.seatAssignment.deleteMany({
          where: {
            bookingId: transaction.bookingId,
          },
        });

        this.logger.log(
          { bookingId: transaction.bookingId },
          'Booking canceled after payment failure',
        );

        await this.outbox.enqueue({
          aggregateId: transaction.bookingId,
          aggregateType: 'Booking',
          topic: `${process.env.RABBITMQ_EXCHANGE || 'booking.events'}:payment.failed`,
          payload: {
            bookingId: transaction.bookingId,
            transactionId: transaction.id,
            reason: 'payment_canceled',
            occurredAt: new Date().toISOString(),
          },
          transport: EnumTransport.RABBITMQ,
        });

        await this.outbox.enqueue({
          aggregateId: transaction.bookingId,
          aggregateType: 'Booking',
          topic: 'payment.failed',
          payload: {
            bookingId: transaction.bookingId,
            transactionId: transaction.id,
            reason: 'payment_canceled',
            occurredAt: new Date().toISOString(),
          },
          transport: EnumTransport.KAFKA,
        });
      }
    });

    if (bookingIdToTicket) {
      await this.outbox.enqueue({
        aggregateId: bookingIdToTicket,
        aggregateType: 'Booking',
        topic: `${process.env.RABBITMQ_EXCHANGE || 'booking.events'}:booking.paid`,
        payload: {
          bookingId: bookingIdToTicket,
          occurredAt: new Date().toISOString(),
        },
        transport: EnumTransport.RABBITMQ,
      });

      await this.outbox.enqueue({
        aggregateId: bookingIdToTicket,
        aggregateType: 'Booking',
        topic: 'booking.paid',
        payload: {
          bookingId: bookingIdToTicket,
          occurredAt: new Date().toISOString(),
        },
        transport: EnumTransport.KAFKA,
      });
    }
  }
}
