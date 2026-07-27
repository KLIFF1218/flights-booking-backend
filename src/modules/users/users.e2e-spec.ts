import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hash } from 'argon2';
import { PassengerType, Role, UserNotificationType, UserStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createE2eApp } from '../../../test/e2e-app.util';

jest.setTimeout(120_000);

describe('Users E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await prisma.userNotification.deleteMany();
    await prisma.savedPassengerProfile.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
  });

  async function registerAndGetToken(
    email: string,
    overrides: { firstName?: string; lastName?: string } = {},
  ) {
    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/register`)
      .send({
        email,
        password: 'Password123',
        firstName: overrides.firstName ?? 'John',
        lastName: overrides.lastName ?? 'Doe',
      })
      .expect(201);

    return res.body.accessToken as string;
  }

  async function createAdminToken() {
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: await hash('Password123'),
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/login`)
      .send({ email: 'admin@test.com', password: 'Password123' })
      .expect(201);

    return res.body.accessToken as string;
  }

  it('GET /users/me — returns current user data', async () => {
    const token = await registerAndGetToken('me@test.com');

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/users/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.email).toBe('me@test.com');
    expect(res.body.firstName).toBe('John');
    expect(res.body.password).toBeUndefined();
  });

  it('GET /users/me — returns 401 without token', async () => {
    await request(app.getHttpServer()).get(`${API_V1}/users/me`).expect(401);
  });

  it('PATCH /users/profile — does not return password in response', async () => {
    const token = await registerAndGetToken('profile@test.com');

    const res = await request(app.getHttpServer())
      .patch(`${API_V1}/users/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jane', lastName: 'Smith', phone: '+79261234567' })
      .expect(200);

    expect(res.body.firstName).toBe('Jane');
    expect(res.body.lastName).toBe('Smith');
    expect(res.body.phone).toBe('+79261234567');
    expect(res.body.password).toBeUndefined();
  });

  it('PATCH /users/profile — returns 409 when email is already taken', async () => {
    await registerAndGetToken('owner@test.com');
    const token = await registerAndGetToken('other@test.com');

    await request(app.getHttpServer())
      .patch(`${API_V1}/users/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'owner@test.com' })
      .expect(409);
  });

  it('GET/PATCH /users/settings — reads and updates settings only', async () => {
    const token = await registerAndGetToken('settings@test.com');

    const initial = await request(app.getHttpServer())
      .get(`${API_V1}/users/settings`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(initial.body).toEqual(
      expect.objectContaining({
        country: null,
        citizenship: null,
        city: null,
      }),
    );
    expect(initial.body).not.toHaveProperty('email');

    const updated = await request(app.getHttpServer())
      .patch(`${API_V1}/users/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'RU', citizenship: 'RU', city: 'Moscow', currency: 'RUB' })
      .expect(200);

    expect(updated.body).toEqual({
      country: 'RU',
      citizenship: 'RU',
      city: 'Moscow',
      currency: 'RUB',
    });
    expect(updated.body).not.toHaveProperty('email');
  });

  it('GET /users/me — returns 401 for blocked user', async () => {
    const token = await registerAndGetToken('blocked@test.com');
    const user = await prisma.user.findUnique({ where: { email: 'blocked@test.com' } });

    await prisma.user.update({
      where: { id: user!.id },
      data: { status: UserStatus.BLOCKED },
    });

    await request(app.getHttpServer())
      .get(`${API_V1}/users/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('saved passengers — create, list and delete', async () => {
    const token = await registerAndGetToken('passenger@test.com');

    const created = await request(app.getHttpServer())
      .post(`${API_V1}/users/me/passengers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        passengerType: PassengerType.ADULT,
        firstName: 'IVAN',
        lastName: 'IVANOV',
        gender: 'MALE',
        dateOfBirth: '1990-01-01',
        passportNumber: '1234567890',
        passportIssuanceDate: '2015-01-01',
        passportExpiry: '2030-01-01',
      })
      .expect(201);

    expect(created.body.passportNumber).toBe('1234567890');

    const list = await request(app.getHttpServer())
      .get(`${API_V1}/users/me/passengers`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`${API_V1}/users/me/passengers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get(`${API_V1}/users/me/passengers`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterDelete.body).toHaveLength(0);
  });

  it('notifications — list, mark read and mark all read', async () => {
    const token = await registerAndGetToken('notify@test.com');
    const user = await prisma.user.findUnique({ where: { email: 'notify@test.com' } });

    await prisma.userNotification.createMany({
      data: [
        {
          userId: user!.id,
          type: UserNotificationType.FLIGHT_DELAYED,
          title: 'Delay 1',
          message: 'Delayed',
        },
        {
          userId: user!.id,
          type: UserNotificationType.FLIGHT_CANCELLED,
          title: 'Cancelled',
          message: 'Cancelled',
        },
      ],
    });

    const list = await request(app.getHttpServer())
      .get(`${API_V1}/users/me/notifications?unreadOnly=true&limit=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(2);

    const unreadCount = await request(app.getHttpServer())
      .get(`${API_V1}/users/me/notifications/unread-count`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(unreadCount.body.count).toBe(2);

    const notificationId = list.body[0].id as string;

    const marked = await request(app.getHttpServer())
      .patch(`${API_V1}/users/me/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(marked.body.readAt).toBeTruthy();

    const markAll = await request(app.getHttpServer())
      .post(`${API_V1}/users/me/notifications/read-all`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(markAll.body.updated).toBe(1);
  });

  it('GET /users — endpoint removed', async () => {
    const token = await registerAndGetToken('list@test.com');

    await request(app.getHttpServer())
      .get(`${API_V1}/users`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /users/:id — endpoint removed', async () => {
    const token = await registerAndGetToken('other@test.com');
    const victim = await prisma.user.create({
      data: {
        email: 'victim@test.com',
        password: 'hashed',
        firstName: 'Victim',
        lastName: 'User',
      },
    });

    await request(app.getHttpServer())
      .get(`${API_V1}/users/${victim.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  describe('Admin /users', () => {
    it('lists users for admin without exposing password', async () => {
      const token = await createAdminToken();
      await registerAndGetToken('listed@test.com', { firstName: 'Listed', lastName: 'User' });

      const res = await request(app.getHttpServer())
        .get(`${API_V1}/admin/users`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0]).not.toHaveProperty('password');
      expect(typeof res.body.data[0].totalSpent).toBe('number');
    });

    it('returns 403 for non-admin', async () => {
      const token = await registerAndGetToken('regular@test.com');

      await request(app.getHttpServer())
        .get(`${API_V1}/admin/users`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('blocks user, revokes access and does not leak password', async () => {
      const adminToken = await createAdminToken();
      const userToken = await registerAndGetToken('toblock@test.com');
      const user = await prisma.user.findUnique({ where: { email: 'toblock@test.com' } });

      const blocked = await request(app.getHttpServer())
        .patch(`${API_V1}/admin/users/${user!.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(blocked.body.status).toBe(UserStatus.BLOCKED);
      expect(blocked.body).not.toHaveProperty('password');

      const activeTokens = await prisma.refreshToken.count({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(activeTokens).toBe(0);

      await request(app.getHttpServer())
        .get(`${API_V1}/users/me`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
    });
  });
});
