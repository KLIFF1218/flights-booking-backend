import { randomUUID } from 'crypto';
import {
  BookingStatus,
  Currency,
  EnumTransport,
  PaymentProvider,
  TransactionStatus,
  type Prisma,
} from '@prisma/client';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';

type PaymentPendingFixture = {
  userId: string;
  bookingId: string;
  transactionId: string;
};

export async function createPaymentPendingFixture(
  prisma: PrismaService,
  userId: string,
): Promise<PaymentPendingFixture> {
  const bookingId = randomUUID();
  const transactionId = randomUUID();

  await prisma.booking.create({
    data: {
      id: bookingId,
      userId,
      status: BookingStatus.PAYMENT_PENDING,
      pnrLocator: `PNR${Date.now()}${Math.floor(Math.random() * 1000)}`,
      flightOrderId: randomUUID(),
      lastTicketingDate: new Date(Date.now() + 86_400_000),
      expiresAt: new Date(Date.now() + 86_400_000),
      totalPrice: 10_000,
      currency: Currency.RUB,
      snapshot: {
        offer: { id: 'offer-1', itineraries: [{ segments: [] }] },
        pricing: { travelers: [] },
      } satisfies Prisma.JsonObject,
      transaction: {
        create: {
          id: transactionId,
          idempotencyKey: randomUUID(),
          status: TransactionStatus.PENDING,
          amount: 10_000,
          currency: Currency.RUB,
          userId,
          provider: PaymentProvider.YOOKASSA,
          paymentExpiresAt: new Date(Date.now() + 3_600_000),
        },
      },
    },
  });

  return { userId, bookingId, transactionId };
}

export function buildYookassaWebhookPayload(params: {
  event: 'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture';
  paymentId: string;
  transactionId: string;
  bookingId: string;
}) {
  const statusByEvent = {
    'payment.succeeded': 'succeeded',
    'payment.canceled': 'canceled',
    'payment.waiting_for_capture': 'waiting_for_capture',
  } as const;

  return {
    type: 'notification',
    event: params.event,
    object: {
      id: params.paymentId,
      status: statusByEvent[params.event],
      amount: { value: '10000.00', currency: 'RUB' },
      metadata: {
        transactionId: params.transactionId,
        bookingId: params.bookingId,
      },
      created_at: new Date().toISOString(),
      payment_method: { type: 'bank_card' },
    },
  };
}

export const EXPECTED_PAID_OUTBOX_TOPICS = ['booking.paid'] as const;

export function countPaidOutboxMessages(
  messages: Array<{ topic: string; transport: EnumTransport }>,
) {
  return {
    kafka: messages.filter(
      (message) =>
        message.topic === 'booking.paid' && message.transport === EnumTransport.KAFKA,
    ).length,
    rabbit: messages.filter(
      (message) =>
        message.topic.endsWith(':booking.paid') &&
        message.transport === EnumTransport.RABBITMQ,
    ).length,
  };
}
