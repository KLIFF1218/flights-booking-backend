const timezoneDateFormatters = new Map<string, Intl.DateTimeFormat>();
const timezoneDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getTimezoneDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timezoneDateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    timezoneDateFormatters.set(timeZone, formatter);
  }

  return formatter;
}

function getTimezoneDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timezoneDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    timezoneDateTimeFormatters.set(timeZone, formatter);
  }

  return formatter;
}

function parseIsoDate(localDate: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    throw new Error(`Invalid local date: ${localDate}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const parts = getTimezoneDateTimeFormatter(timeZone).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function toComparableZonedDateTime(parts: ZonedDateTimeParts): number {
  return (
    parts.year * 1_000_000_000_000 +
    parts.month * 10_000_000_000 +
    parts.day * 100_000_000 +
    parts.hour * 1_000_000 +
    parts.minute * 10_000 +
    parts.second * 100
  );
}

function targetComparableZonedDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  return (
    year * 1_000_000_000_000 +
    month * 10_000_000_000 +
    day * 100_000_000 +
    hour * 1_000_000 +
    minute * 10_000 +
    second * 100
  );
}

export function addDaysToIsoDate(localDate: string, days: number): string {
  const { year, month, day } = parseIsoDate(localDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function zonedTimeToUtc(
  localDate: string,
  timeZone: string,
  localTime: { hour?: number; minute?: number; second?: number } = {},
): Date {
  const { year, month, day } = parseIsoDate(localDate);
  const hour = localTime.hour ?? 0;
  const minute = localTime.minute ?? 0;
  const second = localTime.second ?? 0;
  const target = targetComparableZonedDateTime(year, month, day, hour, minute, second);

  let low = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
  let high = Date.UTC(year, month - 1, day + 1, 23, 59, 59);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const current = toComparableZonedDateTime(getZonedDateTimeParts(new Date(mid), timeZone));

    if (current < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return new Date(low);
}

export function buildDepartureSearchWindow(
  dateFrom: string,
  timeZone: string,
  extraEndDays = 0,
): { dbStart: Date; dbEnd: Date } {
  const dbStart = zonedTimeToUtc(dateFrom, timeZone);
  const dbEnd = zonedTimeToUtc(addDaysToIsoDate(dateFrom, 1 + extraEndDays), timeZone);

  return { dbStart, dbEnd };
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getTimezoneDateFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date in timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const parts = getTimezoneDateTimeFormatter(timeZone).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (hour === undefined || minute === undefined) {
    throw new Error(`Failed to format time in timezone ${timeZone}`);
  }

  return `${hour}:${minute}`;
}

export function matchesLocalDate(date: Date, timeZone: string, targetDate: string): boolean {
  return formatDateInTimeZone(date, timeZone) === targetDate;
}
