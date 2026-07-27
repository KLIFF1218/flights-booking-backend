import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createPaymentE2eApp } from '../../../test/payment-e2e-app.util';
import { registerVerifiedUser } from '../../../test/bookings-e2e.helpers';
import { createPaymentPendingFixture } from '../../../test/payment-e2e.helpers';

jest.setTimeout(180_000);

describe('Payment — E2E', () => {
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

  it('returns transaction status for owner', async () => {
    const email = `pay-status-${Date.now()}@test.local`;
    const token = await registerVerifiedUser(app, API_V1, prisma, email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const { transactionId, bookingId } = await createPaymentPendingFixture(prisma, user.id);

    const response = await request(app.getHttpServer())
      .get(`${API_V1}/payment/transaction/${transactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.transactionId).toBe(transactionId);
    expect(response.body.bookingId).toBe(bookingId);
    expect(response.body.status).toBe(TransactionStatus.PENDING);
    expect(response.body.bookingStatus).toBe(BookingStatus.PAYMENT_PENDING);
    expect(response.body.booking.id).toBe(bookingId);
  });

  it('rejects transaction status for another user', async () => {
    const ownerEmail = `pay-owner-${Date.now()}@test.local`;
    const otherEmail = `pay-other-${Date.now()}@test.local`;
    const ownerToken = await registerVerifiedUser(app, API_V1, prisma, ownerEmail);
    const otherToken = await registerVerifiedUser(app, API_V1, prisma, otherEmail);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    const { transactionId } = await createPaymentPendingFixture(prisma, owner.id);

    await request(app.getHttpServer())
      .get(`${API_V1}/payment/transaction/${transactionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API_V1}/payment/transaction/${transactionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
