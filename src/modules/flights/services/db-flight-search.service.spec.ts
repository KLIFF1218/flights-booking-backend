import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { TravelClass } from '@prisma/client';
import { DbFlightsSearchProvider } from './db-flight-search.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  buildAirport,
  buildMockFlightInstance,
} from '../tests/flights-test.fixtures';

describe('DbFlightsSearchProvider', () => {
  let service: DbFlightsSearchProvider;
  let module: TestingModule;

  const prisma = {
    airport: { findUnique: jest.fn() },
    flightInstance: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (DbFlightsSearchProvider as any).airportCache?.clear?.();

    module = await Test.createTestingModule({
      providers: [DbFlightsSearchProvider, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DbFlightsSearchProvider);
  });

  afterEach(async () => {
    await module.close();
  });

  it('rejects unsupported multi-city searches', async () => {
    await expect(
      service.searchFlights({
        directions: [
          { origin: 'JFK', destination: 'SFO', dateFrom: '2026-08-15' },
          { origin: 'SFO', destination: 'LAX', dateFrom: '2026-08-20' },
          { origin: 'LAX', destination: 'JFK', dateFrom: '2026-08-25' },
        ],
        passengers: { adults: 1 },
        travelClass: TravelClass.ECONOMY,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns empty results when airports are unknown', async () => {
    prisma.airport.findUnique.mockResolvedValue(null);

    const result = await service.searchFlights({
      directions: [{ origin: 'XXX', destination: 'YYY', dateFrom: '2026-08-15' }],
      passengers: { adults: 1 },
      travelClass: TravelClass.ECONOMY,
    });

    expect(result.data).toEqual([]);
    expect(result.meta.count).toBe(0);
    expect(prisma.flightInstance.findMany).not.toHaveBeenCalled();
  });

  it('returns direct one-way offers for matching inventory', async () => {
    const instance = buildMockFlightInstance({
      id: 'fi-jfk-sfo',
      departureDate: new Date('2026-08-15T14:00:00.000Z'),
      origin: 'JFK',
      destination: 'SFO',
    });

    prisma.airport.findUnique.mockImplementation(({ where }: { where: { iataCode: string } }) => {
      if (where.iataCode === 'JFK') {
        return Promise.resolve(buildAirport('JFK', 'America/New_York'));
      }
      if (where.iataCode === 'SFO') {
        return Promise.resolve(buildAirport('SFO', 'America/Los_Angeles'));
      }
      return Promise.resolve(null);
    });

    prisma.flightInstance.findMany
      .mockResolvedValueOnce([instance])
      .mockResolvedValueOnce([instance])
      .mockResolvedValueOnce([]);

    const result = await service.searchFlights({
      directions: [{ origin: 'JFK', destination: 'SFO', dateFrom: '2026-08-15' }],
      passengers: { adults: 1 },
      travelClass: TravelClass.ECONOMY,
      currencyCode: 'USD',
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].id).toBe('fi-jfk-sfo');
    expect(result.data[0].itineraries[0].segments[0].from).toBe('JFK');
    expect(result.data[0].itineraries[0].segments.at(-1)?.to).toBe('SFO');
  });

  it('rejects invalid round-trip directions', async () => {
    prisma.airport.findUnique.mockImplementation(({ where }: { where: { iataCode: string } }) =>
      Promise.resolve(buildAirport(where.iataCode, 'UTC')),
    );

    await expect(
      service.searchFlights({
        directions: [
          { origin: 'JFK', destination: 'SFO', dateFrom: '2026-08-20' },
          { origin: 'SFO', destination: 'JFK', dateFrom: '2026-08-15' },
        ],
        passengers: { adults: 1 },
        travelClass: TravelClass.ECONOMY,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
