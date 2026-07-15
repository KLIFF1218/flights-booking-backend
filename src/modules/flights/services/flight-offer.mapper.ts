import { Injectable } from '@nestjs/common';
import { PreprocessedFlightOffer } from '../types/flights.types';
import { FlightCardResponse } from '../interfaces/flight-response.dto';
import { Itinerary } from '../interfaces/flight-offers.interface';
import { parseDuration } from '../utils/duration.util';

@Injectable()
export class FlightOfferMapper {
  toCard(offer: PreprocessedFlightOffer): FlightCardResponse {
    const routes = offer.itineraries.map((itinerary) => {
      const segments = this.mapSegments(itinerary);
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      return {
        availableSeats: offer.numberOfBookableSeats,
        from: firstSegment.from,
        to: lastSegment.to,
        departure: {
          airport: firstSegment.from,
          time: firstSegment.departureTime,
          date: firstSegment.departureTime,
        },
        arrival: {
          airport: lastSegment.to,
          time: lastSegment.arrivalTime,
          date: lastSegment.arrivalTime,
        },
        durationMinutes: parseDuration(itinerary.duration),
        stops: Math.max(segments.length - 1, 0),
        stopCodes: segments.map((segment) => segment.to).slice(0, -1),
        airline: firstSegment.airline,
        airlineIata: firstSegment.airlineIata,
        segments,
      };
    });

    return {
      offerId: offer.id,
      price: {
        total: Number(offer.price.total),
        currency: offer.price.currency,
      },
      routes,
      totalDurationMinutes: routes.reduce((sum, route) => sum + route.durationMinutes, 0),
    };
  }

  private mapSegments(itinerary: Itinerary) {
    return itinerary.segments.map((segment) => ({
      from: segment.departure.iataCode,
      to: segment.arrival.iataCode,
      departureTime: segment.departure.at,
      arrivalTime: segment.arrival.at,
      airline: segment.airline,
      airlineIata: segment.airlineIata,
      flightNumber: segment.number,
      durationMinutes: parseDuration(segment.duration),
    }));
  }
}
