import { BadRequestException } from '@nestjs/common';
import { AirportsService } from './airports.service';
import {
  AIRPORT_SEARCH_ORDER_BY,
  buildAirportSearchWhere,
  MAX_AIRPORT_SEARCH_LIMIT,
} from '../utils/airport-search.util';
import { encodeCursor } from 'src/shared/utils/cursor.util';

const airportRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '1',
  name: 'Sheremetyevo International Airport',
  city: 'Moscow',
  country: 'Russia',
  iataCode: 'SVO',
  icaoCode: 'UUEE',
  latitude: 55.97,
  longitude: 37.41,
  ...overrides,
});

describe('AirportsService', () => {
  const prisma = {
    airport: {
      findMany: jest.fn(),
    },
  };

  let service: AirportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AirportsService(prisma as any);
  });

  it('rejects queries shorter than 2 characters', async () => {
    await expect(service.searchAirports({ q: 'a' })).rejects.toThrow(BadRequestException);
  });

  it('rejects empty and whitespace-only queries', async () => {
    await expect(service.searchAirports({ q: '' })).rejects.toThrow(BadRequestException);
    await expect(service.searchAirports({ q: '  ' })).rejects.toThrow(BadRequestException);
  });

  it('returns cursor pagination metadata', async () => {
    prisma.airport.findMany.mockResolvedValue([
      airportRow(),
      airportRow({
        id: '2',
        name: 'Domodedovo',
        iataCode: 'DME',
      }),
    ]);

    const result = await service.searchAirports({ q: 'mos', limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({
      count: 1,
      limit: 1,
      hasNextPage: true,
      nextCursor: encodeCursor({
        city: 'Moscow',
        name: 'Sheremetyevo International Airport',
        id: '1',
      }),
    });
  });

  it('uses default limit and caps at MAX_AIRPORT_SEARCH_LIMIT', async () => {
    prisma.airport.findMany.mockResolvedValue([]);

    await service.searchAirports({ q: 'mos' });
    expect(prisma.airport.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 11 }));

    await service.searchAirports({ q: 'mos', limit: 999 });
    expect(prisma.airport.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: MAX_AIRPORT_SEARCH_LIMIT + 1 }),
    );
  });

  it('passes country filter into search where clause', async () => {
    prisma.airport.findMany.mockResolvedValue([]);

    await service.searchAirports({ q: 'mos', country: 'Russia' });

    const call = prisma.airport.findMany.mock.calls[0][0];
    expect(call.where).toEqual(buildAirportSearchWhere('mos', 'Russia'));
  });

  it('combines search where with cursor for subsequent pages', async () => {
    prisma.airport.findMany.mockResolvedValue([]);
    const cursor = encodeCursor({
      city: 'Moscow',
      name: 'Domodedovo',
      id: '1',
    });

    await service.searchAirports({ q: 'mos', cursor });

    const call = prisma.airport.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      AND: [
        buildAirportSearchWhere('mos'),
        {
          OR: [
            { city: { gt: 'Moscow' } },
            { city: 'Moscow', name: { gt: 'Domodedovo' } },
            { city: 'Moscow', name: 'Domodedovo', id: { gt: '1' } },
          ],
        },
      ],
    });
  });

  it('returns no next page when results fit within limit', async () => {
    prisma.airport.findMany.mockResolvedValue([airportRow()]);

    const result = await service.searchAirports({ q: 'svo', limit: 10 });

    expect(result.meta).toEqual({
      count: 1,
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    });
  });

  it('rejects malformed cursor tokens', async () => {
    await expect(service.searchAirports({ q: 'mos', cursor: 'not-valid' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('queries prisma with expected select, orderBy and take', async () => {
    prisma.airport.findMany.mockResolvedValue([]);

    await service.searchAirports({ q: 'mos', limit: 5 });

    expect(prisma.airport.findMany).toHaveBeenCalledWith({
      where: buildAirportSearchWhere('mos'),
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        iataCode: true,
        icaoCode: true,
        latitude: true,
        longitude: true,
      },
      orderBy: AIRPORT_SEARCH_ORDER_BY,
      take: 6,
    });
  });
});
