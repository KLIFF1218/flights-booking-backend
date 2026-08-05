import type { BuiltSegment } from 'src/modules/bookings/types/segment.types';
import { toSegmentEndpointDto } from '../utils/datetime/flight-time.mapper';
import { buildTimeline } from '../utils/datetime/timeline.util';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import { formatDuration } from '../utils/datetime/time.util';

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
      departure: toSegmentEndpointDto(
        event.departureAt.toISOString(),
        seg.departureAirport.iataCode,
        seg.departureAirport.timezone,
      ),
      arrival: toSegmentEndpointDto(
        event.arrivalAt.toISOString(),
        seg.arrivalAirport.iataCode,
        seg.arrivalAirport.timezone,
      ),
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
