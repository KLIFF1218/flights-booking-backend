import type { Itinerary } from '../interfaces/flight-offers.interface';
import { calculateDuration } from './duration.util';

export function mapItinerary(itinerary: Itinerary) {
  const segments = itinerary.segments.map((s) => ({
    segmentId: s.id,
    from: s.departure.iataCode,
    to: s.arrival.iataCode,
    departureTime: s.departure.at,
    arrivalTime: s.arrival.at,
    airline: s.carrierCode,
    flightNumber: s.number,
  }));

  if (segments.length === 0) {
    throw new Error('No segments in itinerary');
  }

  const lastSegment = segments[segments.length - 1];

  return {
    from: segments[0].from,
    to: lastSegment.to,
    departureTime: segments[0].departureTime,
    arrivalTime: lastSegment.arrivalTime,
    durationMinutes: calculateDuration(itinerary.segments),
    stops: segments.length - 1,
    segments,
  };
}
