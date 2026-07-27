import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hash } from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createAdminE2eApp } from '../../../test/admin-e2e-app.util';

jest.setTimeout(90_000);

describe('Admin E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createAdminE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.airport.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  async function registerUserToken(email: string) {
    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/register`)
      .send({
        email,
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    return res.body.accessToken as string;
  }

  async function createAdminToken() {
    await prisma.user.create({
      data: {
        email: 'admin-panel@test.com',
        password: await hash('Password123'),
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/login`)
      .send({ email: 'admin-panel@test.com', password: 'Password123' })
      .expect(201);

    return res.body.accessToken as string;
  }

  it('GET /admin/dashboard — returns 401 without token', async () => {
    await request(app.getHttpServer()).get(`${API_V1}/admin/dashboard`).expect(401);
  });

  it('GET /admin/dashboard — returns 403 for non-admin', async () => {
    const token = await registerUserToken(`admin-dash-user-${Date.now()}@test.com`);

    await request(app.getHttpServer())
      .get(`${API_V1}/admin/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/dashboard — returns stats for admin', async () => {
    const token = await createAdminToken();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/admin/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        totalUsers: expect.any(Number),
        totalBookings: expect.any(Number),
        totalRevenue: expect.any(Number),
        bookingsByStatus: expect.any(Array),
        topRoutes: expect.any(Array),
        eventAnalytics: expect.any(Object),
      }),
    );
  });

  it('GET /admin/bookings — returns 403 for non-admin', async () => {
    const token = await registerUserToken(`admin-bookings-user-${Date.now()}@test.com`);

    await request(app.getHttpServer())
      .get(`${API_V1}/admin/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/bookings — returns paginated list for admin', async () => {
    const token = await createAdminToken();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/admin/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      data: [],
      meta: expect.objectContaining({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
    });
  });

  it('GET /admin/airports — returns 403 for non-admin', async () => {
    const token = await registerUserToken(`admin-airports-user-${Date.now()}@test.com`);

    await request(app.getHttpServer())
      .get(`${API_V1}/admin/airports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /admin/airports — returns airport list for admin', async () => {
    await prisma.airport.create({
      data: {
        name: 'Sheremetyevo',
        city: 'Moscow',
        country: 'Russia',
        iataCode: 'SVO',
      },
    });
    const token = await createAdminToken();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/admin/airports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      city: 'Moscow',
      iataCode: 'SVO',
    });
    expect(res.body.meta).toEqual(
      expect.objectContaining({
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      }),
    );
  });
});
