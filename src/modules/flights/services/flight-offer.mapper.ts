import { Injectable } from '@nestjs/common';
import { PreprocessedFlightOffer } from '../types/flights.types';
import { FlightCardResponse } from '../interfaces/flight-response.dto';
import { Itinerary } from '../interfaces/flight-offers.interface';
import { parseDuration } from '../utils/datetime/duration.util';
import { toFlightTimeDto } from '../utils/datetime/flight-time.mapper';

@Injectable()
export class FlightOfferMapper {
  toCard(offer: PreprocessedFlightOffer): FlightCardResponse {
    const routes = offer.itineraries.map((itinerary) => {
      const segments = this.mapSegments(itinerary);
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      const departure = toFlightTimeDto(
        firstSegment.departureTime,
        firstSegment.from,
        firstSegment.departureTimezone,
      );
      const arrival = toFlightTimeDto(
        lastSegment.arrivalTime,
        lastSegment.to,
        lastSegment.arrivalTimezone,
      );

      return {
        availableSeats: offer.numberOfBookableSeats,
        from: firstSegment.from,
        to: lastSegment.to,
        departure: {
          airport: departure.airport,
          time: departure.at,
          date: departure.at,
          localDate: departure.localDate,
          localTime: departure.localTime,
          timezone: departure.timezone,
        },
        arrival: {
          airport: arrival.airport,
          time: arrival.at,
          date: arrival.at,
          localDate: arrival.localDate,
          localTime: arrival.localTime,
          timezone: arrival.timezone,
        },
        durationMinutes: parseDuration(itinerary.duration),
        stops: Math.max(segments.length - 1, 0),
        stopCodes: segments.map((segment) => segment.to).slice(0, -1),
        airline: firstSegment.airline,
        airlineIata: firstSegment.airlineIata,
        segments,
      };
    });

    const firstFareDetail = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0];

    return {
      offerId: offer.id,
      source: offer.source ?? 'INTERNAL_DB',
      fareBrand: offer.fareBrand ?? firstFareDetail?.brandName ?? 'LIGHT',
      price: {
        total: Number(offer.price.total),
        currency: offer.price.currency,
      },
      cabin: firstFareDetail?.cabin ?? 'ECONOMY',
      checkedBags: firstFareDetail?.includedCheckedBags?.quantity ?? 0,
      changeable: offer.changeable ?? firstFareDetail?.changeable ?? false,
      refundable: offer.refundable ?? firstFareDetail?.refundable ?? false,
      routes,
      totalDurationMinutes: routes.reduce((sum, route) => sum + route.durationMinutes, 0),
    };
  }

  private mapSegments(itinerary: Itinerary) {
    return itinerary.segments.map((segment) => {
      const departure = toFlightTimeDto(
        segment.departure.at,
        segment.departure.iataCode,
        segment.departure.timezone,
      );
      const arrival = toFlightTimeDto(
        segment.arrival.at,
        segment.arrival.iataCode,
        segment.arrival.timezone,
      );

      return {
        from: segment.departure.iataCode,
        to: segment.arrival.iataCode,
        departureTime: segment.departure.at,
        arrivalTime: segment.arrival.at,
        departureLocalDate: departure.localDate,
        departureLocalTime: departure.localTime,
        departureTimezone: departure.timezone,
        arrivalLocalDate: arrival.localDate,
        arrivalLocalTime: arrival.localTime,
        arrivalTimezone: arrival.timezone,
        airline: segment.airline,
        airlineIata: segment.airlineIata,
        flightNumber: segment.number,
        durationMinutes: parseDuration(segment.duration),
      };
    });
  }
}
