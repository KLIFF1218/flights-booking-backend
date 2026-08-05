import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BookingStatus, EnumTransport, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createPaymentE2eApp } from '../../../../test/payment-e2e-app.util';
import { registerVerifiedUser } from '../../../../test/bookings-e2e.helpers';
import {
  buildYookassaWebhookPayload,
  countPaidOutboxMessages,
  createPaymentPendingFixture,
} from '../../../../test/payment-e2e.helpers';

jest.setTimeout(180_000);

describe('Payment Webhook — E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createPaymentE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  }, 120_000);

  afterEach(async () => {
    await prisma.outboxMessage.deleteMany();
    await prisma.idempotencyOperation.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('exposes yookassa webhook health endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_V1}/webhook/yookassa`)
      .expect(200);

    expect(response.body).toEqual({ ok: true });
  });

  it('processes yookassa payment.succeeded webhook and marks booking paid', async () => {
    const email = `wh-paid-${Date.now()}@test.local`;
    await registerVerifiedUser(app, API_V1, prisma, email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const { bookingId, transactionId } = await createPaymentPendingFixture(prisma, user.id);
    const paymentId = `pay-${Date.now()}`;

    const payload = buildYookassaWebhookPayload({
      event: 'payment.succeeded',
      paymentId,
      transactionId,
      bookingId,
    });

    await request(app.getHttpServer())
      .post(`${API_V1}/webhook/yookassa`)
      .send(payload)
      .expect(200)
      .expect({ ok: true });

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });

    expect(booking.status).toBe(BookingStatus.PAID);
    expect(transaction.status).toBe(TransactionStatus.SUCCEED);
    expect(transaction.externalId).toBe(paymentId);

    const outbox = await prisma.outboxMessage.findMany({
      where: { aggregateId: bookingId },
    });
    const paidOutbox = countPaidOutboxMessages(outbox);
    expect(paidOutbox.kafka).toBe(1);
    expect(paidOutbox.rabbit).toBe(1);
  });

  it('ignores duplicate yookassa webhook via idempotency', async () => {
    const email = `wh-dup-${Date.now()}@test.local`;
    await registerVerifiedUser(app, API_V1, prisma, email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const { bookingId, transactionId } = await createPaymentPendingFixture(prisma, user.id);
    const paymentId = `pay-dup-${Date.now()}`;

    const payload = buildYookassaWebhookPayload({
      event: 'payment.succeeded',
      paymentId,
      transactionId,
      bookingId,
    });

    await request(app.getHttpServer()).post(`${API_V1}/webhook/yookassa`).send(payload).expect(200);
    await request(app.getHttpServer()).post(`${API_V1}/webhook/yookassa`).send(payload).expect(200);

    const operations = await prisma.idempotencyOperation.findMany({
      where: { key: `${transactionId}:${TransactionStatus.SUCCEED}` },
    });
    expect(operations).toHaveLength(1);
    expect(operations[0]?.status).toBe('COMPLETED');

    const outbox = await prisma.outboxMessage.findMany({
      where: { aggregateId: bookingId, transport: EnumTransport.KAFKA, topic: 'booking.paid' },
    });
    expect(outbox).toHaveLength(1);
  });

  it('rejects stripe webhook without signature', async () => {
    await request(app.getHttpServer())
      .post(`${API_V1}/webhook/stripe`)
      .send({ type: 'checkout.session.completed' })
      .expect(401);
  });
});
