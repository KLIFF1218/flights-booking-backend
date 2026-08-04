import type { Currency, FareBrand, TravelClass } from '@prisma/client';
import type {
  FlightOffer,
  Itinerary,
  PassengerCounts,
} from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import {
  buildTravelerPricings,
  calculateTotalPrice,
  MissingFareError,
} from './traveler-pricing.util';
import { mapSegments } from '../services/flight-segment.mapper';
import { buildTimeline } from './timeline.util';
import { formatDuration } from './time.util';
import { buildOneWayLeg } from './offer-flight-instances.util';
import { buildFarePriceBreakdown, formatOfferPrice } from './fare-charges.util';
import { countSeatsRequired } from 'src/shared/booking/passenger-counts.util';
import {
  DEFAULT_SEARCH_FARE_BRAND,
  OFFER_SOURCE_INTERNAL_DB,
  resolveFareBrandRules,
} from '../constants/fare-brand.constants';

export function buildOneWayOffers(
  instances: FlightInstanceWithRelations[],
  passengers: PassengerCounts,
  travelClass: TravelClass,
  targetCurrency: Currency,
  offerCache: Map<string, FlightOffer>,
  fareBrand: FareBrand = DEFAULT_SEARCH_FARE_BRAND,
): FlightOffer[] {
  return instances.flatMap((instance) => {
    try {
      const pricing = calculateTotalPrice(
        instance,
        passengers,
        travelClass,
        targetCurrency,
        fareBrand,
      );
      const priceBreakdown = buildFarePriceBreakdown(pricing.base, countSeatsRequired(passengers));
      const brandRules = resolveFareBrandRules(fareBrand, travelClass);

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
        source: OFFER_SOURCE_INTERNAL_DB,
        fareBrand,
        changeable: brandRules.changeable,
        refundable: brandRules.refundable,
        currencyCode: targetCurrency,
        legs: [buildOneWayLeg(instance.id)],
        numberOfBookableSeats: instance.seatsAvailable,
        itineraries: [itinerary],
        price: formatOfferPrice(targetCurrency, priceBreakdown),
        travelerPricings: buildTravelerPricings(
          instance,
          passengers,
          travelClass,
          targetCurrency,
          fareBrand,
        ),
      };

      offerCache.set(instance.id, offer);
      return [offer];
    } catch (error) {
      if (error instanceof MissingFareError) {
        return [];
      }
      throw error;
    }
  });
}
