import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createSeatmapsE2eApp } from '../../../test/seatmaps-e2e-app.util';
import { findSearchOffer, registerVerifiedUser } from './bookings-e2e.helpers';
import { seedDemoDataset } from '../scripts/seeds/demo.seed';

jest.setTimeout(180_000);

describe('Seatmaps — E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createSeatmapsE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
    await seedDemoDataset();
  }, 120_000);

  afterEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns seat map for a cached search offer', async () => {
    const token = await registerVerifiedUser(
      app,
      API_V1,
      prisma,
      `seatmap-${Date.now()}@test.local`,
    );
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    const response = await request(app.getHttpServer())
      .post(`${API_V1}/seatmaps/by-offer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ searchId, offerId })
      .expect(201);

    expect(response.body.unavailable).toBe(false);
    expect(response.body.seatMaps.length).toBeGreaterThanOrEqual(1);
    expect(response.body.seatMaps[0].segmentId).toBeTruthy();
    expect(response.body.seatMaps[0].grid.length).toBeGreaterThan(0);

    const hasSeat = response.body.seatMaps[0].grid.some((row: Array<{ type: string }>) =>
      row.some((cell) => cell.type === 'SEAT'),
    );
    expect(hasSeat).toBe(true);
  });

  it('returns 404 when offer is missing from search cache', async () => {
    const token = await registerVerifiedUser(
      app,
      API_V1,
      prisma,
      `seatmap-404-${Date.now()}@test.local`,
    );
    const { searchId } = await findSearchOffer(app, API_V1);

    await request(app.getHttpServer())
      .post(`${API_V1}/seatmaps/by-offer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ searchId, offerId: 'missing-offer-id' })
      .expect(404);
  });

  it('requires authentication', async () => {
    const { searchId, offerId } = await findSearchOffer(app, API_V1);

    await request(app.getHttpServer())
      .post(`${API_V1}/seatmaps/by-offer`)
      .send({ searchId, offerId })
      .expect(401);
  });
});
