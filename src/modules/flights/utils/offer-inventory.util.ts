import { FlightStatus } from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import {
  countSeatsRequired,
  type PassengerCountsInput,
} from 'src/shared/booking/passenger-counts.util';

const UNBOOKABLE_STATUSES: FlightStatus[] = [FlightStatus.CANCELLED, FlightStatus.COMPLETED];

export function collectOfferFlightInstanceIds(offer: FlightOffer): string[] {
  return [
    ...new Set(
      offer.itineraries.flatMap((itinerary) =>
        itinerary.segments.map((segment) => segment.flightInstanceId),
      ),
    ),
  ];
}

export function resolveOfferBookableSeats(
  offer: FlightOffer,
  instancesMap: Map<string, FlightInstanceWithRelations>,
): number | null {
  const instanceIds = collectOfferFlightInstanceIds(offer);
  if (instanceIds.length === 0) {
    return null;
  }

  const instances = instanceIds.map((id) => instancesMap.get(id));
  if (instances.some((instance) => !instance)) {
    return null;
  }

  if (instances.some((instance) => UNBOOKABLE_STATUSES.includes(instance!.status))) {
    return null;
  }

  return Math.min(...instances.map((instance) => instance!.seatsAvailable));
}

export function isOfferInventoryBookable(
  offer: FlightOffer,
  instancesMap: Map<string, FlightInstanceWithRelations>,
  passengers?: PassengerCountsInput,
): boolean {
  const bookableSeats = resolveOfferBookableSeats(offer, instancesMap);
  if (bookableSeats === null) {
    return false;
  }

  if (!passengers) {
    return bookableSeats > 0;
  }

  return bookableSeats >= countSeatsRequired(passengers);
}
