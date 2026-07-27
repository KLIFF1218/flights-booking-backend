import { randomUUID } from 'crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Gender } from 'src/modules/bookings/dtos/traveler.input.dto';
import { E2E_PAYMENT_REDIRECT_URL } from './e2e-payment.stubs';

type SearchOffer = {
  searchId: string;
  offerId: string;
};

type SeatSelection = {
  segmentId: string;
  seatNumber: string;
};

export async function findSearchOffer(
  app: INestApplication,
  apiV1: string,
): Promise<SearchOffer> {
  for (const offset of [2, 1, 3, 4, 5]) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    const dateFrom = d.toISOString().slice(0, 10);
    const search = await request(app.getHttpServer())
      .post(`${apiV1}/flights/search`)
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

export async function registerVerifiedUser(
  app: INestApplication,
  apiV1: string,
  prisma: { user: { update: (args: unknown) => Promise<unknown> } },
  email: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`${apiV1}/auth/register`)
    .send({
      email,
      password: 'Password123',
      firstName: 'Book',
      lastName: 'Tester',
    })
    .expect(201);

  await prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() },
  });

  return res.body.accessToken as string;
}

export async function pickAvailableSeat(
  app: INestApplication,
  apiV1: string,
  token: string,
  searchId: string,
  offerId: string,
  segmentId?: string,
): Promise<SeatSelection> {
  const seatMap = await request(app.getHttpServer())
    .post(`${apiV1}/seatmaps/by-offer`)
    .set('Authorization', `Bearer ${token}`)
    .send({ searchId, offerId })
    .expect(201);

  const maps = seatMap.body.seatMaps as Array<{
    segmentId: string;
    grid: Array<Array<{ type: string; seatNumber?: string; isAvailable?: boolean }>>;
  }>;

  const target =
    (segmentId ? maps.find((map) => map.segmentId === segmentId) : undefined) ?? maps[0];

  if (!target) {
    throw new Error('Seat map is empty');
  }

  for (const row of target.grid) {
    for (const cell of row) {
      if (cell.type === 'SEAT' && cell.isAvailable && cell.seatNumber) {
        return { segmentId: target.segmentId, seatNumber: cell.seatNumber };
      }
    }
  }

  throw new Error('No available seats in seat map');
}

export function buildAdultTraveler() {
  const travelerId = randomUUID();

  return {
    id: travelerId,
    travelers: [
      {
        id: travelerId,
        firstName: 'Alex',
        lastName: 'Flyer',
        gender: Gender.MALE,
        dateOfBirth: '1990-05-15',
        nationality: 'US',
        birthPlace: 'New York',
        passportNumber: 'P1234567',
        passportIssuanceDate: '2020-01-01',
        passportExpiry: '2030-01-01',
      },
    ],
  };
}

export { E2E_PAYMENT_REDIRECT_URL };
