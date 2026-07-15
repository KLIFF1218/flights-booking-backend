import type { FlightInstanceWithRelations } from 'src/modules/bookings/types/prisma.types';
import type { SegmentTimeline } from '../interfaces/segment-timeline.interface';
import { timeStringOf } from './time.util';

export function buildTimeline(instance: FlightInstanceWithRelations): SegmentTimeline[] {
  const segments = instance.flight.segments;
  const timeline: SegmentTimeline[] = [];
  if (segments.length === 0) return timeline;

  let currentDeparture = new Date(instance.departureDate);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i > 0) {
      const prevSeg = segments[i - 1];
      const [prevH, prevM] = timeStringOf(prevSeg.arrivalTime).split(':').map(Number);
      const [currH, currM] = timeStringOf(seg.departureTime).split(':').map(Number);

      let layover = currH * 60 + currM - (prevH * 60 + prevM);
      if (layover < 0) {
        layover += 24 * 60;
      }
      currentDeparture = new Date(
        currentDeparture.getTime() + prevSeg.durationMinutes * 60000 + layover * 60000,
      );
    }

    const arrivalAt = new Date(currentDeparture.getTime() + seg.durationMinutes * 60000);
    const prevSegmentTimeline = timeline[i - 1];
    const layoverMinutes = prevSegmentTimeline
      ? Math.floor((currentDeparture.getTime() - prevSegmentTimeline.arrivalAt.getTime()) / 60000)
      : 0;

    timeline.push({
      departureAt: new Date(currentDeparture),
      arrivalAt,
      layoverMinutes,
    });
  }

  return timeline;
}
