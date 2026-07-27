import { buildAirportSearchCursorWhere, buildAirportSearchWhere } from './airport-search.util';

describe('airport-search.util', () => {
  it('builds search filters for iata, text fields and aliases', () => {
    const where = buildAirportSearchWhere(' mos ');

    expect(where).toEqual({
      OR: [
        { iataCode: { startsWith: 'MOS' } },
        { name: { contains: 'mos', mode: 'insensitive' } },
        { city: { contains: 'mos', mode: 'insensitive' } },
        { country: { contains: 'mos', mode: 'insensitive' } },
        {
          aliases: {
            some: {
              name: {
                contains: 'mos',
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    });
  });

  it('adds optional country filter', () => {
    const where = buildAirportSearchWhere('mos', 'Russia');

    expect(where.AND).toEqual([
      {
        country: {
          contains: 'Russia',
          mode: 'insensitive',
        },
      },
    ]);
  });

  it('ignores blank country filter', () => {
    const where = buildAirportSearchWhere('mos', '   ');

    expect(where.AND).toBeUndefined();
  });

  it('uses uppercase IATA prefix for two-character queries', () => {
    const where = buildAirportSearchWhere('sv');

    expect(where.OR?.[0]).toEqual({ iataCode: { startsWith: 'SV' } });
  });

  it('builds stable cursor filter for city/name/id ordering', () => {
    expect(
      buildAirportSearchCursorWhere({
        city: 'Moscow',
        name: 'Sheremetyevo International Airport',
        id: 'airport-1',
      }),
    ).toEqual({
      OR: [
        { city: { gt: 'Moscow' } },
        { city: 'Moscow', name: { gt: 'Sheremetyevo International Airport' } },
        {
          city: 'Moscow',
          name: 'Sheremetyevo International Airport',
          id: { gt: 'airport-1' },
        },
      ],
    });
  });
});
