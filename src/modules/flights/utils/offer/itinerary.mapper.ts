import type { Itinerary } from '../../interfaces/flight-offers.interface';
import { calculateDoorToDoorDurationMinutes } from '../datetime/duration.util';
import { toFlightTimeDto } from '../datetime/flight-time.mapper';

export function mapItinerary(itinerary: Itinerary) {
  const segments = itinerary.segments.map((s) => {
    const departure = toFlightTimeDto(s.departure.at, s.departure.iataCode, s.departure.timezone);
    const arrival = toFlightTimeDto(s.arrival.at, s.arrival.iataCode, s.arrival.timezone);

    const airlineIata = s.airlineIata ?? s.carrierCode;

    return {
      segmentId: s.id,
      from: s.departure.iataCode,
      to: s.arrival.iataCode,
      departureTime: s.departure.at,
      arrivalTime: s.arrival.at,
      departureLocalDate: departure.localDate,
      departureLocalTime: departure.localTime,
      departureTimezone: departure.timezone,
      arrivalLocalDate: arrival.localDate,
      arrivalLocalTime: arrival.localTime,
      arrivalTimezone: arrival.timezone,
      airlineName: s.airline,
      airlineIata,
      airline: airlineIata,
      flightNumber: s.number,
    };
  });

  if (segments.length === 0) {
    throw new Error('No segments in itinerary');
  }

  const lastSegment = segments[segments.length - 1];
  const firstSegment = segments[0];

  return {
    from: firstSegment.from,
    to: lastSegment.to,
    departureTime: firstSegment.departureTime,
    arrivalTime: lastSegment.arrivalTime,
    departureLocalDate: firstSegment.departureLocalDate,
    departureLocalTime: firstSegment.departureLocalTime,
    departureTimezone: firstSegment.departureTimezone,
    arrivalLocalDate: lastSegment.arrivalLocalDate,
    arrivalLocalTime: lastSegment.arrivalLocalTime,
    arrivalTimezone: lastSegment.arrivalTimezone,
    durationMinutes: calculateDoorToDoorDurationMinutes(
      firstSegment.departureTime,
      lastSegment.arrivalTime,
    ),
    stops: segments.length - 1,
    segments,
  };
}
