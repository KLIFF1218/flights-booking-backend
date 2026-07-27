import { toFlightLocalTime } from './flight-local-time.util';

describe('flight-local-time.util', () => {
  it('formats departure local date/time in the airport timezone', () => {
    const result = toFlightLocalTime('2026-07-22T20:00:00.000Z', 'SVO');

    expect(result).toEqual({
      localDate: '2026-07-22',
      localTime: '23:00',
      timezone: 'Europe/Moscow',
    });
  });

  it('keeps the departure on the previous local day for late-evening UTC instants', () => {
    const result = toFlightLocalTime('2026-07-22T21:00:00.000Z', 'SVO');

    expect(result.localDate).toBe('2026-07-23');
    expect(result.localTime).toBe('00:00');
  });
});
