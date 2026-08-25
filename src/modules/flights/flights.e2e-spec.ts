import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API_V1, createFlightsE2eApp } from '../../../test/flights-e2e-app.util';
import { seedDemoDataset } from '../scripts/seeds/demo.seed';

jest.setTimeout(180_000);

async function findSearchOffer(app: INestApplication) {
  for (const offset of [2, 1, 3, 4, 5]) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    const dateFrom = d.toISOString().slice(0, 10);
    const search = await request(app.getHttpServer())
      .post(`${API_V1}/flights/search`)
      .send({
        directions: [{ origin: 'JFK', destination: 'SFO', dateFrom }],
        passengers: { adults: 1 },
        travelClass: 'ECONOMY',
        currencyCode: 'USD',
      });

    if (search.status === 201 && search.body?.data?.[0]?.offerId) {
      return {
        searchId: search.body.searchId as string,
        offerId: search.body.data[0].offerId as string,
      };
    }
  }

  throw new Error('No flight offers in demo seed');
}

describe('Flights — E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const bootstrapped = await createFlightsE2eApp();
    app = bootstrapped.app;
    await seedDemoDataset();
  }, 120_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('searches flights and returns cached page', async () => {
    const { searchId } = await findSearchOffer(app);

    const page = await request(app.getHttpServer())
      .get(`${API_V1}/flights/search/${searchId}`)
      .query({ limit: 5, sort: 'CHEAPEST' })
      .expect(200);

    expect(page.body.searchId).toBe(searchId);
    expect(page.body.data.length).toBeGreaterThanOrEqual(1);
    expect(page.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('prices a cached offer', async () => {
    const { searchId, offerId } = await findSearchOffer(app);

    const pricing = await request(app.getHttpServer())
      .post(`${API_V1}/flight/pricing`)
      .send({ searchId, offerId })
      .expect(201);

    expect(pricing.body.id).toBe(offerId);
    expect(pricing.body.quoteId).toBeTruthy();
    expect(pricing.body.price.total).toBeGreaterThan(0);
    expect(pricing.body.price.currency).toBe('USD');
  });

  it('returns the same search results from cache on repeat query', async () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 3);
    const dateFrom = d.toISOString().slice(0, 10);
    const body = {
      directions: [{ origin: 'JFK', destination: 'SFO', dateFrom }],
      passengers: { adults: 1 },
      travelClass: 'ECONOMY',
      currencyCode: 'USD',
    };

    const first = await request(app.getHttpServer())
      .post(`${API_V1}/flights/search`)
      .send(body)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`${API_V1}/flights/search`)
      .send(body)
      .expect(201);

    expect(second.body.searchId).toBe(first.body.searchId);
    expect(second.body.data).toEqual(first.body.data);
  });
});
