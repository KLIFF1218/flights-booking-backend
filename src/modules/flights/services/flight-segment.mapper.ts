import type { BuiltSegment } from 'src/modules/bookings/types/segment.types';
import { buildTimeline } from '../utils/timeline.util';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import { formatDuration } from '../utils/time.util';

export function mapSegments(instance: FlightInstanceWithRelations): BuiltSegment[] {
  const segments = instance.flight.segments;
  const timeline = buildTimeline(instance);

  return segments.map((seg, index) => {
    const event = timeline[index];

    return {
      id: seg.id,
      flightInstanceId: instance.id,
      from: seg.departureAirport.iataCode,
      to: seg.arrivalAirport.iataCode,
      departure: {
        at: event.departureAt.toISOString(),
        iataCode: seg.departureAirport.iataCode,
      },
      arrival: {
        at: event.arrivalAt.toISOString(),
        iataCode: seg.arrivalAirport.iataCode,
      },
      duration: formatDuration(seg.durationMinutes),
      carrierCode: seg.carrierCode,
      number: seg.flightNumber,
      aircraft: seg.aircraft?.code ?? seg.aircraft?.name ?? null,
      operating: {
        carrierCode: seg.carrierCode,
      },
      blacklistedInEU: false,
      airline: instance.flight.airline.name,
      airlineIata: instance.flight.airline.code,
    };
  });
}
