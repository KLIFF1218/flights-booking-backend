import { toFlightTimeDto, toSegmentEndpointDto } from './flight-time.mapper';

describe('flight-time.mapper', () => {
  it('maps UTC instant to flight time dto using airport timezone', () => {
    const result = toFlightTimeDto('2026-07-22T20:00:00.000Z', 'SVO');

    expect(result).toEqual({
      at: '2026-07-22T20:00:00.000Z',
      airport: 'SVO',
      localDate: '2026-07-22',
      localTime: '23:00',
      timezone: 'Europe/Moscow',
    });
  });

  it('prefers explicit timezone from the database over the hardcoded map', () => {
    const result = toFlightTimeDto('2026-04-01T10:00:00.000Z', 'SVO', 'Europe/Helsinki');

    expect(result.timezone).toBe('Europe/Helsinki');
    expect(result.localTime).toBe('13:00');
  });

  it('maps segment endpoints with iataCode field', () => {
    const result = toSegmentEndpointDto('2026-07-22T20:00:00.000Z', 'SVO', 'Europe/Moscow');

    expect(result).toEqual({
      iataCode: 'SVO',
      at: '2026-07-22T20:00:00.000Z',
      localDate: '2026-07-22',
      localTime: '23:00',
      timezone: 'Europe/Moscow',
    });
  });
});
