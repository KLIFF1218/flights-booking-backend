import type { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';
import { mapItinerary } from 'src/modules/flights/utils/itinerary.mapper';

export interface BookingListRoute {
  from: string;
  to: string;
  departureDate: string;
  arrivalDate: string;
  departureLocalDate?: string;
  departureLocalTime?: string;
  departureTimezone?: string;
  arrivalLocalDate?: string;
  arrivalLocalTime?: string;
  arrivalTimezone?: string;
  number: string;
  airline: string;
  stops: number;
}

export function mapOfferToBookingRoutes(offer: FlightOffer | undefined): BookingListRoute[] {
  if (!offer?.itineraries?.length) {
    return [];
  }

  return offer.itineraries.map((itinerary) => {
    const mapped = mapItinerary(itinerary);
    const firstSegment = itinerary.segments[0];

    return {
      from: mapped.from,
      to: mapped.to,
      departureDate: mapped.departureTime,
      arrivalDate: mapped.arrivalTime,
      departureLocalDate: mapped.departureLocalDate,
      departureLocalTime: mapped.departureLocalTime,
      departureTimezone: mapped.departureTimezone,
      arrivalLocalDate: mapped.arrivalLocalDate,
      arrivalLocalTime: mapped.arrivalLocalTime,
      arrivalTimezone: mapped.arrivalTimezone,
      number: firstSegment ? `${firstSegment.carrierCode}${firstSegment.number}` : '',
      airline: firstSegment?.carrierCode ?? '',
      stops: mapped.stops,
    };
  });
}
