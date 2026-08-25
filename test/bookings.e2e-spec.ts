import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BookingStatus, EnumTransport, TransactionStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createBookingsE2eApp } from './bookings-e2e-app.util';
import {
  buildAdultTraveler,
  E2E_PAYMENT_REDIRECT_URL,
  findSearchOffer,
  pickAvailableSeat,
  registerVerifiedUser,
} from './bookings-e2e.helpers';
import { seedDemoDataset } from '../scripts/seeds/demo.seed';

jest.setTimeout(180_000);

describe('Bookings — E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createBookingsE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
    await seedDemoDataset();
  }, 120_000);

  afterEach(async () => {
    await prisma.outboxMessage.deleteMany();
    await prisma.bookingIdempotencyRecord.deleteMany();
    await prisma.seatAssignment.deleteMany();
    await prisma.seatHold.deleteMany();
    await prisma.traveler.deleteMany();
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

  it('creates booking from search offer with idempotency key', async () => {
    const token = await registerVerifiedUser(app, API_V1, prisma, `book-${Date.now()}@test.local`);
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    const res = await request(app.getHttpServer())
      .post(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `idem-${Date.now()}`)
      .send({ searchId, offerId })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe(BookingStatus.PNR_CREATED);

    const outbox = await prisma.outboxMessage.findFirst({
      where: { aggregateId: res.body.id, topic: 'booking.created' },
    });
    expect(outbox).not.toBeNull();
    expect(outbox?.transport).toBe(EnumTransport.KAFKA);
  });

  it('rejects booking without idempotency key', async () => {
    const token = await registerVerifiedUser(
      app,
      API_V1,
      prisma,
      `no-idem-${Date.now()}@test.local`,
    );
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    await request(app.getHttpServer())
      .post(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .send({ searchId, offerId })
      .expect(400);
  });

  it('returns booking by id for owner', async () => {
    const token = await registerVerifiedUser(app, API_V1, prisma, `get-${Date.now()}@test.local`);
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    const created = await request(app.getHttpServer())
      .post(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `get-${Date.now()}`)
      .send({ searchId, offerId })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`${API_V1}/booking/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.id).toBe(created.body.id);
  });

  it('lists user bookings', async () => {
    const token = await registerVerifiedUser(app, API_V1, prisma, `list-${Date.now()}@test.local`);
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    await request(app.getHttpServer())
      .post(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `list-${Date.now()}`)
      .send({ searchId, offerId })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.bookings.length).toBeGreaterThanOrEqual(1);
  });

  it('completes travelers → seats → checkout → resume payment', async () => {
    const email = `flow-${Date.now()}@test.local`;
    const token = await registerVerifiedUser(app, API_V1, prisma, email);
    const { searchId, offerId } = await findSearchOffer(app, API_V1);
    const { travelers, id: clientTravelerId } = buildAdultTraveler();

    const created = await request(app.getHttpServer())
      .post(`${API_V1}/booking`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `flow-${Date.now()}`)
      .send({ searchId, offerId })
      .expect(201);

    const bookingId = created.body.id as string;
    const segmentId = created.body.snapshot.offer.itineraries[0].segments[0].id as string;

    const withTravelers = await request(app.getHttpServer())
      .post(`${API_V1}/booking/${bookingId}/travelers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ travelers })
      .expect(201);

    expect(withTravelers.body.travelers).toHaveLength(1);
    expect(withTravelers.body.status).toBe(BookingStatus.PNR_CREATED);

    const travelerId = withTravelers.body.travelers[0].id as string;
    expect(travelerId).toBe(clientTravelerId);

    const seat = await pickAvailableSeat(app, API_V1, token, searchId, offerId, segmentId);

    const withSeats = await request(app.getHttpServer())
      .post(`${API_V1}/booking/${bookingId}/seats`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        seats: [
          {
            travelerId,
            segmentId: seat.segmentId,
            seatNumber: seat.seatNumber,
          },
        ],
      })
      .expect(201);

    expect(withSeats.body.success).toBe(true);

    const afterSeats = await request(app.getHttpServer())
      .get(`${API_V1}/booking/${bookingId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterSeats.body.status).toBe(BookingStatus.SEATS_SELECTED);

    const checkout = await request(app.getHttpServer())
      .post(`${API_V1}/booking/${bookingId}/seats/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ searchId, offerId, seats: [] })
      .expect(201);

    expect(checkout.body.paymentRedirectUrl).toBe(E2E_PAYMENT_REDIRECT_URL);

    const afterCheckout = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transaction: true },
    });

    expect(afterCheckout?.status).toBe(BookingStatus.PAYMENT_PENDING);
    expect(afterCheckout?.transaction?.status).toBe(TransactionStatus.PENDING);
    expect(afterCheckout?.transaction?.externalId).toBe('e2e_payment_ext');

    const cleanupOutbox = await prisma.outboxMessage.findFirst({
      where: { aggregateId: bookingId, topic: 'checkout.cleanup' },
    });
    expect(cleanupOutbox).not.toBeNull();

    const resume = await request(app.getHttpServer())
      .post(`${API_V1}/booking/${bookingId}/payment/resume`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(resume.body.paymentRedirectUrl).toBe(E2E_PAYMENT_REDIRECT_URL);
    expect(resume.body.transactionId).toBe(afterCheckout?.transaction?.id);
  });
});
