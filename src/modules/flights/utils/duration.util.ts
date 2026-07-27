import type { BuiltSegment } from 'src/modules/bookings/types/segment.types';

const DURATION_REGEX = /PT(?:(\d+)H)?(?:(\d+)M)?/;

export function parseDuration(duration?: string): number {
  if (!duration) return 0;

  const matches = DURATION_REGEX.exec(duration);
  if (!matches) return 0;

  const hours = matches[1] ? Number(matches[1]) : 0;
  const minutes = matches[2] ? Number(matches[2]) : 0;

  return hours * 60 + minutes;
}

export function calculateDuration(segments: BuiltSegment[]) {
  let total = 0;

  for (const s of segments) {
    if (!s.duration) {
      continue;
    }

    const isoDurationRegex = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;
    const match = s.duration.match(isoDurationRegex);

    if (!match) {
      continue;
    }

    const hours = match[1] ? Number(match[1]) : 0;
    const minutes = match[2] ? Number(match[2]) : 0;

    total += hours * 60 + minutes;
  }

  return total;
}

export function calculateDoorToDoorDurationMinutes(
  departureAt: string | Date,
  arrivalAt: string | Date,
): number {
  const departure = departureAt instanceof Date ? departureAt : new Date(departureAt);
  const arrival = arrivalAt instanceof Date ? arrivalAt : new Date(arrivalAt);

  return Math.floor((arrival.getTime() - departure.getTime()) / 60_000);
}
