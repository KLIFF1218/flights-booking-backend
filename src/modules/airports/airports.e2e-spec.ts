import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createAirportsE2eApp } from '../../../test/airports-e2e-app.util';

jest.setTimeout(60_000);

describe('Airports E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const bootstrapped = await createAirportsE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.airportAlias.deleteMany();
    await prisma.airport.deleteMany();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  async function seedAirports() {
    await prisma.airport.create({
      data: {
        name: 'Sheremetyevo International Airport',
        city: 'Moscow',
        country: 'Russia',
        iataCode: 'SVO',
        icaoCode: 'UUEE',
        aliases: {
          create: [{ name: 'Sheremetyevo' }],
        },
      },
    });

    await prisma.airport.create({
      data: {
        name: 'Domodedovo',
        city: 'Moscow',
        country: 'Russia',
        iataCode: 'DME',
      },
    });

    await prisma.airport.create({
      data: {
        name: 'Pulkovo',
        city: 'Saint Petersburg',
        country: 'Russia',
        iataCode: 'LED',
      },
    });
  }

  it('GET /airports/search — finds airport by IATA prefix without auth', async () => {
    await seedAirports();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'SV' })
      .expect(200);

    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iataCode: 'SVO',
          city: 'Moscow',
        }),
      ]),
    );
    expect(res.body.meta).toMatchObject({
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    });
  });

  it('GET /airports/search — finds airport by city name', async () => {
    await seedAirports();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'petersburg' })
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      iataCode: 'LED',
      city: 'Saint Petersburg',
    });
  });

  it('GET /airports/search — finds airport by alias', async () => {
    await seedAirports();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'sherem' })
      .expect(200);

    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iataCode: 'SVO',
        }),
      ]),
    );
  });

  it('GET /airports/search — filters by country', async () => {
    await seedAirports();

    const res = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'mos', country: 'Russia' })
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((a: { country: string }) => a.country === 'Russia')).toBe(true);
  });

  it('GET /airports/search — returns 400 when query is too short', async () => {
    await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'a' })
      .expect(400);
  });

  it('GET /airports/search — paginates with cursor', async () => {
    await seedAirports();

    const firstPage = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'mo', limit: 1 })
      .expect(200);

    expect(firstPage.body.data).toHaveLength(1);
    expect(firstPage.body.meta.hasNextPage).toBe(true);
    expect(firstPage.body.meta.nextCursor).toBeTruthy();

    const secondPage = await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({
        q: 'mo',
        limit: 1,
        cursor: firstPage.body.meta.nextCursor,
      })
      .expect(200);

    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.data[0].id).not.toBe(firstPage.body.data[0].id);
  });

  it('GET /airports/search — returns 400 for malformed cursor', async () => {
    await seedAirports();

    await request(app.getHttpServer())
      .get(`${API_V1}/airports/search`)
      .query({ q: 'sv', cursor: 'not-a-valid-cursor' })
      .expect(400);
  });
});
