import {
  buildAdminFlightsDateWindow,
  buildAdminFlightsSearchFilter,
  buildAdminFlightsWhere,
} from './admin-flights-query.util';

describe('admin-flights-query.util', () => {
  it('returns undefined search filter for blank search', () => {
    expect(buildAdminFlightsSearchFilter(undefined)).toBeUndefined();
    expect(buildAdminFlightsSearchFilter('   ')).toBeUndefined();
  });

  it('builds case-insensitive search across flight number, airline and airports', () => {
    expect(buildAdminFlightsSearchFilter(' su ')).toEqual({
      OR: [
        { flight: { flightNumber: { contains: 'su', mode: 'insensitive' } } },
        { flight: { airline: { name: { contains: 'su', mode: 'insensitive' } } } },
        { flight: { departureAirport: { iataCode: { contains: 'su', mode: 'insensitive' } } } },
        { flight: { arrivalAirport: { iataCode: { contains: 'su', mode: 'insensitive' } } } },
      ],
    });
  });

  it('combines date window and search filter with AND', () => {
    const where = buildAdminFlightsWhere({ status: 'completed', search: 'SU' });

    expect(where).toEqual({
      AND: [
        expect.objectContaining({
          status: 'COMPLETED',
          departureDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        expect.objectContaining({
          OR: expect.any(Array),
        }),
      ],
    });
  });

  it('uses active and finished OR window when status is not provided', () => {
    const where = buildAdminFlightsDateWindow();

    expect(where).toEqual({
      OR: [
        {
          status: { in: ['SCHEDULED', 'DELAYED'] },
          departureDate: { gte: expect.any(Date), lte: expect.any(Date) },
        },
        {
          status: { in: ['COMPLETED', 'CANCELLED'] },
          departureDate: { gte: expect.any(Date) },
        },
      ],
    });
  });

  it('limits delayed flights to upcoming 7-day window', () => {
    const where = buildAdminFlightsDateWindow('delayed');

    expect(where).toEqual({
      status: 'DELAYED',
      departureDate: { gte: expect.any(Date), lte: expect.any(Date) },
    });
  });
});
