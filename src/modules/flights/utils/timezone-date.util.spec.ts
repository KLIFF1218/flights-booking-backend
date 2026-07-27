import {
  buildDepartureSearchWindow,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  matchesLocalDate,
  zonedTimeToUtc,
} from './timezone-date.util';

describe('timezone-date.util', () => {
  it('formats a UTC instant using the airport timezone', () => {
    const instant = new Date('2026-04-01T23:30:00.000Z');

    expect(formatDateInTimeZone(instant, 'America/New_York')).toBe('2026-04-01');
    expect(formatDateInTimeZone(instant, 'Asia/Tokyo')).toBe('2026-04-02');
  });

  it('formats local time in the airport timezone', () => {
    const instant = new Date('2026-07-22T20:00:00.000Z');

    expect(formatTimeInTimeZone(instant, 'Europe/Moscow')).toBe('23:00');
  });

  it('matches requested local dates without locale-specific parsing', () => {
    const instant = new Date('2026-04-01T10:00:00.000Z');

    expect(matchesLocalDate(instant, 'Europe/Helsinki', '2026-04-01')).toBe(true);
    expect(matchesLocalDate(instant, 'Europe/Helsinki', '2026-04-02')).toBe(false);
  });

  it('anchors local midnight in the departure airport timezone', () => {
    const start = zonedTimeToUtc('2026-04-01', 'America/New_York');

    expect(start.toISOString()).toBe('2026-04-01T04:00:00.000Z');
    expect(formatDateInTimeZone(start, 'America/New_York')).toBe('2026-04-01');
  });

  it('builds a search window for the requested local departure day', () => {
    const { dbStart, dbEnd } = buildDepartureSearchWindow('2026-04-01', 'Europe/Helsinki');

    expect(formatDateInTimeZone(dbStart, 'Europe/Helsinki')).toBe('2026-04-01');
    expect(formatDateInTimeZone(new Date(dbEnd.getTime() - 1), 'Europe/Helsinki')).toBe(
      '2026-04-01',
    );
    expect(formatDateInTimeZone(dbEnd, 'Europe/Helsinki')).toBe('2026-04-02');
  });
});
