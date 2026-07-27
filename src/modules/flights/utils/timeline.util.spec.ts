import { buildTimeline, buildSegmentDepartureAt } from './timeline.util';

describe('timeline.util', () => {
  const utcAirport = { iataCode: 'UTC', timezone: 'UTC' };

  const baseInstance = {
    departureDate: new Date('2026-04-01T00:00:00.000Z'),
    flight: {
      segments: [],
    },
  };

  it('builds departure from dayOffset and departureTime in airport timezone', () => {
    const departureAt = buildSegmentDepartureAt(baseInstance.departureDate, 1, '06:30', 'UTC');

    expect(departureAt.toISOString()).toBe('2026-04-02T06:30:00.000Z');
  });

  it('uses instance departureDate for single-segment flights (delay-safe)', () => {
    const timeline = buildTimeline({
      departureDate: new Date('2026-07-22T03:30:00.000Z'),
      flight: {
        segments: [
          {
            dayOffset: 0,
            departureTime: '06:00',
            arrivalTime: '12:30',
            durationMinutes: 390,
            departureAirport: utcAirport,
          },
        ],
      },
    } as any);

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.departureAt.toISOString()).toBe('2026-07-22T03:30:00.000Z');
    expect(timeline[0]?.arrivalAt.toISOString()).toBe('2026-07-22T10:00:00.000Z');
  });

  it('applies dayOffset for overnight connections in airport timezone', () => {
    const timeline = buildTimeline({
      ...baseInstance,
      flight: {
        segments: [
          {
            dayOffset: 0,
            departureTime: '22:00',
            arrivalTime: '02:00',
            durationMinutes: 240,
            departureAirport: utcAirport,
          },
          {
            dayOffset: 1,
            departureTime: '06:00',
            arrivalTime: '08:00',
            durationMinutes: 120,
            departureAirport: utcAirport,
          },
        ],
      },
    } as any);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.departureAt.toISOString()).toBe('2026-04-01T22:00:00.000Z');
    expect(timeline[0]?.arrivalAt.toISOString()).toBe('2026-04-02T02:00:00.000Z');
    expect(timeline[1]?.departureAt.toISOString()).toBe('2026-04-02T06:00:00.000Z');
    expect(timeline[1]?.layoverMinutes).toBe(240);
  });

  it('uses Moscow timezone for segment departures when airport timezone is set', () => {
    const departureAt = buildSegmentDepartureAt(
      new Date('2026-04-01T00:00:00.000Z'),
      0,
      '23:00',
      'Europe/Moscow',
    );

    expect(departureAt.toISOString()).toBe('2026-04-01T20:00:00.000Z');
  });
});
