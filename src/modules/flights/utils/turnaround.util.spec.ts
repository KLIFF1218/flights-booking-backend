import {
  getMinTurnaroundMinutes,
  meetsMinimumTurnaround,
  MIN_DOMESTIC_TURNAROUND_MINUTES,
  MIN_INTERNATIONAL_TURNAROUND_MINUTES,
} from './turnaround.util';

describe('turnaround.util', () => {
  it('uses domestic minimum for same-country round trips', () => {
    expect(getMinTurnaroundMinutes('Russia', 'Russia')).toBe(MIN_DOMESTIC_TURNAROUND_MINUTES);
  });

  it('uses international minimum for cross-border round trips', () => {
    expect(getMinTurnaroundMinutes('Russia', 'Germany')).toBe(MIN_INTERNATIONAL_TURNAROUND_MINUTES);
  });

  it('rejects turnarounds shorter than the configured minimum', () => {
    const outboundArrival = new Date('2026-04-01T10:00:00.000Z');
    const returnDeparture = new Date('2026-04-01T11:30:00.000Z');

    expect(meetsMinimumTurnaround(outboundArrival, returnDeparture, 120)).toBe(false);
    expect(meetsMinimumTurnaround(outboundArrival, returnDeparture, 90)).toBe(true);
  });
});
