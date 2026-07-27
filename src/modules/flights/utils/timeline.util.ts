import type { FlightInstanceWithRelations } from 'src/modules/bookings/types/prisma.types';
import type { SegmentTimeline } from '../interfaces/segment-timeline.interface';
import { resolveAirportTimezone } from './airport-timezone.util';
import { addDaysToIsoDate, formatDateInTimeZone, zonedTimeToUtc } from './timezone-date.util';
import { timeStringOf } from './time.util';

type SegmentWithDepartureAirport = {
  dayOffset: number;
  departureTime: string;
  durationMinutes: number;
  departureAirport: {
    iataCode: string;
    timezone?: string | null;
  };
};

function resolveSegmentTimezone(segment: SegmentWithDepartureAirport): string {
  return (
    segment.departureAirport.timezone || resolveAirportTimezone(segment.departureAirport.iataCode)
  );
}

export function buildSegmentDepartureAt(
  instanceDepartureDate: Date,
  dayOffset: number,
  departureTime: string,
  airportTimezone: string,
): Date {
  const [hours, minutes] = timeStringOf(departureTime).split(':').map(Number);
  const anchorLocalDate = formatDateInTimeZone(instanceDepartureDate, airportTimezone);
  const localDate = addDaysToIsoDate(anchorLocalDate, dayOffset);

  return zonedTimeToUtc(localDate, airportTimezone, { hour: hours, minute: minutes });
}

export function buildTimeline(instance: FlightInstanceWithRelations): SegmentTimeline[] {
  const segments = instance.flight.segments;
  if (segments.length === 0) {
    return [];
  }

  if (segments.length === 1) {
    const seg = segments[0];
    const departureAt = new Date(instance.departureDate);
    const arrivalAt = new Date(departureAt.getTime() + seg.durationMinutes * 60_000);

    return [{ departureAt, arrivalAt, layoverMinutes: 0 }];
  }

  const timeline: SegmentTimeline[] = [];
  const baseDepartureDate = new Date(instance.departureDate);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const airportTimezone = resolveSegmentTimezone(seg);
    const departureAt = buildSegmentDepartureAt(
      baseDepartureDate,
      seg.dayOffset,
      seg.departureTime,
      airportTimezone,
    );
    const arrivalAt = new Date(departureAt.getTime() + seg.durationMinutes * 60_000);

    const previousSegment = timeline[i - 1];
    const layoverMinutes = previousSegment
      ? Math.floor((departureAt.getTime() - previousSegment.arrivalAt.getTime()) / 60_000)
      : 0;

    timeline.push({
      departureAt,
      arrivalAt,
      layoverMinutes,
    });
  }

  return timeline;
}
