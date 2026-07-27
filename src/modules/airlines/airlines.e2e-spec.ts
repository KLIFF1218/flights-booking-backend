import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hash } from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createAirlinesE2eApp } from '../../../test/airlines-e2e-app.util';

jest.setTimeout(60_000);

describe('Airlines E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createAirlinesE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.airline.deleteMany();
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
        email: 'admin-airlines@test.com',
        password: await hash('Password123'),
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/login`)
      .send({ email: 'admin-airlines@test.com', password: 'Password123' })
      .expect(201);

    return res.body.accessToken as string;
  }

  async function seedAirlines() {
    await prisma.airline.createMany({
      data: [
        { code: 'SU', name: 'Aeroflot' },
        { code: 'LH', name: 'Lufthansa' },
      ],
    });
  }

  it('GET /airlines — returns 401 without token', async () => {
    await request(app.getHttpServer()).get(`${API_V1}/airlines`).expect(401);
  });

  it('GET /airlines — returns airline list for authenticated user', async () => {
    await seedAirlines();
    const token = await registerUserToken(`airlines-user-${Date.now()}@test.com`);

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airlines`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SU', name: 'Aeroflot' }),
        expect.objectContaining({ code: 'LH', name: 'Lufthansa' }),
      ]),
    );
    for (const airline of res.body) {
      expect(airline).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          code: expect.any(String),
        }),
      );
      expect(Object.keys(airline).sort()).toEqual(['code', 'id', 'name']);
    }
  });

  it('GET /airlines — returns empty array when no airlines exist', async () => {
    const token = await registerUserToken(`airlines-empty-${Date.now()}@test.com`);

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airlines`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('GET /airlines — allows admin role', async () => {
    await seedAirlines();
    const token = await createAdminToken();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airlines`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.length).toBe(2);
  });
});
