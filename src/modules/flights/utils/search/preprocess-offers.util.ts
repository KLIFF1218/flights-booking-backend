import type { FlightOffer } from '../../interfaces/flight-offers.interface';
import type { PreprocessedFlightOffer } from '../../types/flights.types';
import { parseDuration } from '../datetime/duration.util';

export function preprocessOffers(offers: FlightOffer[]): PreprocessedFlightOffer[] {
  return offers.map((offer) => {
    const totalDurationMinutes = offer.itineraries.reduce((sum, itinerary) => {
      return sum + parseDuration(itinerary.duration);
    }, 0);

    const firstItinerary = offer.itineraries[0];
    const departureTimestamp =
      firstItinerary && firstItinerary.segments[0]
        ? new Date(firstItinerary.segments[0].departure.at).getTime()
        : 0;

    const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
    let arrivalTimestamp = 0;
    if (lastItinerary && lastItinerary.segments && lastItinerary.segments.length > 0) {
      const lastSegment = lastItinerary.segments[lastItinerary.segments.length - 1];
      arrivalTimestamp = new Date(lastSegment.arrival.at).getTime();
    }

    const totalStops = offer.itineraries.reduce((sum, itinerary) => {
      return sum + Math.max(itinerary.segments.length - 1, 0);
    }, 0);

    return {
      ...offer,
      preprocessed: {
        totalDurationMinutes,
        departureTimestamp,
        arrivalTimestamp,
        totalStops,
      },
    };
  });
}
