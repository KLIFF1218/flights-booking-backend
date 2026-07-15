import type { Currency, TravelClass } from '@prisma/client';
import type {
  FlightOffer,
  Itinerary,
  PassengerCounts,
} from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import { buildTravelerPricings, calculateTotalPrice } from './traveler-pricing.util';
import { mapSegments } from '../services/flight-segment.mapper';
import { buildTimeline } from './timeline.util';
import { formatDuration } from './time.util';

export function buildOneWayOffers(
  instances: FlightInstanceWithRelations[],
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
  offerCache: Map<string, FlightOffer>,
): FlightOffer[] {
  return instances.map((instance) => {
    const pricing = calculateTotalPrice(instance, passengers, travelClass, targetCurrency);

    const segments = mapSegments(instance);

    const timeline = buildTimeline(instance);
    const departureTime = timeline[0].departureAt;
    const arrivalTime = timeline[timeline.length - 1].arrivalAt;
    const totalDurationMinutes = Math.floor(
      (arrivalTime.getTime() - departureTime.getTime()) / 60000,
    );

    const itinerary: Itinerary = {
      duration: formatDuration(totalDurationMinutes),
      segments,
    };

    const offer: FlightOffer = {
      id: instance.id,
      numberOfBookableSeats: instance.seatsAvailable,
      itineraries: [itinerary],
      price: {
        currency: targetCurrency,
        total: pricing.total.toFixed(2),
        base: pricing.total.toFixed(2),
        grandTotal: pricing.total.toFixed(2),
        fees: [],
      },
      travelerPricings: buildTravelerPricings(instance, passengers, travelClass, targetCurrency),
    };

    offerCache.set(instance.id, offer);
    return offer;
  });
}
