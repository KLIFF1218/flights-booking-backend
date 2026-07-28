import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hash } from 'argon2';
import { Role, SeatType } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createAircraftsE2eApp } from '../../../test/aircrafts-e2e-app.util';

jest.setTimeout(60_000);

describe('Aircrafts E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createAircraftsE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.seatTemplate.deleteMany();
    await prisma.aircraftLayout.deleteMany();
    await prisma.aircraft.deleteMany();
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
        email: 'admin-aircrafts@test.com',
        password: await hash('Password123'),
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/login`)
      .send({ email: 'admin-aircrafts@test.com', password: 'Password123' })
      .expect(201);

    return res.body.accessToken as string;
  }

  async function seedAircrafts() {
    const aeroflot = await prisma.airline.create({
      data: { code: 'SU', name: 'Aeroflot' },
    });
    const lufthansa = await prisma.airline.create({
      data: { code: 'LH', name: 'Lufthansa' },
    });

    await prisma.aircraft.create({
      data: {
        code: 'A320-SU',
        name: 'Airbus A320',
        airlineId: aeroflot.id,
        aircraftLayout: {
          create: {
            width: 6,
            length: 30,
            seats: {
              create: [
                { number: '1A', x: 0, y: 0, seatType: SeatType.WINDOW, deck: 0 },
                { number: '1B', x: 1, y: 0, seatType: SeatType.MIDDLE, deck: 0 },
                { number: '1C', x: 2, y: 0, seatType: SeatType.AISLE, deck: 0 },
              ],
            },
          },
        },
      },
    });

    await prisma.aircraft.create({
      data: {
        code: 'B737-LH',
        name: 'Boeing 737',
        airlineId: lufthansa.id,
      },
    });

    return { aeroflot, lufthansa };
  }

  it('GET /aircrafts — returns 401 without token', async () => {
    await request(app.getHttpServer()).get(`${API_V1}/aircrafts`).expect(401);
  });

  it('GET /aircrafts — returns aircraft list for authenticated user', async () => {
    await seedAircrafts();
    const token = await registerUserToken(`aircrafts-user-${Date.now()}@test.com`);

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/aircrafts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'A320-SU',
          name: 'Airbus A320',
          seatsCount: 3,
        }),
        expect.objectContaining({
          code: 'B737-LH',
          name: 'Boeing 737',
          seatsCount: 0,
        }),
      ]),
    );

    for (const aircraft of res.body) {
      expect(Object.keys(aircraft).sort()).toEqual([
        'airlineId',
        'code',
        'id',
        'name',
        'seatsCount',
      ]);
    }
  });

  it('GET /aircrafts — filters by airlineId', async () => {
    const { aeroflot } = await seedAircrafts();
    const token = await registerUserToken(`aircrafts-filter-${Date.now()}@test.com`);

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/aircrafts`)
      .query({ airlineId: aeroflot.id })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      code: 'A320-SU',
      airlineId: aeroflot.id,
      seatsCount: 3,
    });
  });

  it('GET /aircrafts — returns empty array when no aircraft exist', async () => {
    const token = await registerUserToken(`aircrafts-empty-${Date.now()}@test.com`);

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/aircrafts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('GET /aircrafts — allows admin role', async () => {
    await seedAircrafts();
    const token = await createAdminToken();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/aircrafts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.length).toBe(2);
  });
});
