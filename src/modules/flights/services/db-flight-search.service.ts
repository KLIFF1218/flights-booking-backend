import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  FlightOffersResponse,
  FlightSearchParams,
  PassengerCounts,
  TravelClass,
  FlightOffer,
} from '../interfaces/flight-offers.interface';
import type {
  FlightInstanceWithRelations,
  FlightSegmentWithRelations,
} from 'src/modules/bookings/types/prisma.types';
import { BuiltSegment } from 'src/modules/bookings/types/segment.types';
import { PassengerType } from '@prisma/client';

const MIN_CONNECTION_MINUTES = 45;
const MAX_CONNECTION_MINUTES = 6 * 60;

@Injectable()
export class DbFlightsSearchProvider {
  constructor(private readonly prisma: PrismaService) {}

  async searchFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    if (params.directions.length === 1) {
      return this.searchOneWayFlights(params);
    } else if (params.directions.length === 2) {
      return this.searchRoundTripFlights(params);
    } else {
      throw new Error('Only one-way and round-trip searches are supported');
    }
  }

  private async searchOneWayFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    const direction = params.directions[0];

    const start = new Date(direction.dateFrom);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const take = Math.min((params.limit ?? 20) * 10, 1000);

    const instances = await this.prisma.flightInstance.findMany({
      where: {
        departureDate: {
          gte: start,
          lt: end,
        },
        flight: {
          departureAirport: {
            iataCode: direction.origin,
          },
          arrivalAirport: {
            iataCode: direction.destination,
          },
        },
      },
      orderBy: {
        departureDate: 'asc',
      },
      take,
      include: {
        fares: true,
        flight: {
          include: {
            airline: true,
            segments: {
              orderBy: {
                segmentOrder: 'asc',
              },
              include: {
                departureAirport: true,
                arrivalAirport: true,
                aircraft: true,
              },
            },
          },
        },
      },
    });

    const directOffers = this.buildDirectFlights(instances, direction, params);

    const connectionOffers = this.buildConnections(instances, direction, params);

    const data = [...directOffers, ...connectionOffers];

    return {
      meta: {
        count: data.length,
      },
      data,
    };
  }

  private async searchRoundTripFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    if (params.directions.length !== 2) {
      throw new Error('Round trip requires 2 directions');
    }

    const limit = params.limit ?? 20;
    const [outboundDirection, returnDirection] = params.directions;

    const outboundOffers = await this.searchOneWayFlights({
      ...params,
      directions: [outboundDirection],
      limit: limit * 5,
    });

    const returnOffers = await this.searchOneWayFlights({
      ...params,
      directions: [returnDirection],
      limit: limit * 5,
    });

    const combinedOffers: FlightOffer[] = [];

    for (const outbound of outboundOffers.data) {
      for (const returnFlight of returnOffers.data) {
        const combinedId = `${outbound.id}_${returnFlight.id}`;
        const totalPrice = parseFloat(outbound.price.total) + parseFloat(returnFlight.price.total);
        const minSeats = Math.min(
          outbound.numberOfBookableSeats,
          returnFlight.numberOfBookableSeats,
        );

        combinedOffers.push({
          ...outbound,
          id: combinedId,
          oneWay: false,
          numberOfBookableSeats: minSeats,
          itineraries: [outbound.itineraries[0], returnFlight.itineraries[0]],
          price: {
            ...outbound.price,
            total: totalPrice.toFixed(2),
            base: totalPrice.toFixed(2),
            grandTotal: totalPrice.toFixed(2),
          },
        });
      }
    }

    combinedOffers.sort((a, b) => Number(a.price.total) - Number(b.price.total));

    return {
      meta: {
        count: combinedOffers.length,
      },
      data: combinedOffers.slice(0, limit),
    };
  }

  private buildDirectFlights(
    instances: FlightInstanceWithRelations[],
    direction: FlightSearchParams['directions'][0],
    params: FlightSearchParams,
  ) {
    const results: FlightOffersResponse['data'] = [];

    for (const instance of instances) {
      const segments = instance.flight.segments;
      if (!segments.length) continue;

      const first = segments[0];
      const last = segments[segments.length - 1];

      if (
        first.departureAirport.iataCode !== direction.origin ||
        last.arrivalAirport.iataCode !== direction.destination
      ) {
        continue;
      }

      const builtSegments = this.buildSegments(segments, instance);
      const stops = builtSegments.length - 1;

      results.push(this.buildOffer(instance, builtSegments, stops, params));
    }

    return results;
  }

  private buildConnections(
    instances: FlightInstanceWithRelations[],
    direction: FlightSearchParams['directions'][0],
    params: FlightSearchParams,
  ) {
    const results: FlightOffersResponse['data'] = [];

    const byDepartureAirport = new Map<string, FlightInstanceWithRelations[]>();

    for (const instance of instances) {
      const firstSeg = instance.flight.segments[0];

      if (!firstSeg?.departureAirport?.iataCode) {
        continue;
      }

      const airport = firstSeg.departureAirport.iataCode;

      if (!byDepartureAirport.has(airport)) {
        byDepartureAirport.set(airport, []);
      }

      byDepartureAirport.get(airport)!.push(instance);
    }

    const flightsFromOrigin = byDepartureAirport.get(direction.origin) || [];

    for (const first of flightsFromOrigin) {
      const firstSegments = first.flight.segments;
      const firstLastSeg = firstSegments[firstSegments.length - 1];
      const connectionAirport = firstLastSeg.arrivalAirport.iataCode;

      if (!connectionAirport) {
        continue;
      }

      const secondFlights = byDepartureAirport.get(connectionAirport) || [];
      const firstBuiltSegments = this.buildSegments(first.flight.segments, first);
      const firstArrival = new Date(firstBuiltSegments[firstBuiltSegments.length - 1].arrival.at);

      for (const second of secondFlights) {
        const secondDeparture = new Date(second.departureDate);
        const diff = (secondDeparture.getTime() - firstArrival.getTime()) / 60000;

        if (diff < MIN_CONNECTION_MINUTES || diff > MAX_CONNECTION_MINUTES) {
          continue;
        }

        const secondLastSeg = second.flight.segments[second.flight.segments.length - 1];

        if (secondLastSeg.arrivalAirport.iataCode !== direction.destination) {
          continue;
        }

        const segments = [
          ...firstBuiltSegments,
          ...this.buildSegments(second.flight.segments, second),
        ];

        const firstPricing = this.calculateTotalPrice(first, params.passengers, params.travelClass);
        const secondPricing = this.calculateTotalPrice(
          second,
          params.passengers,
          params.travelClass,
        );

        const totalPrice = firstPricing.total + secondPricing.total;
        const stops = segments.length - 1;

        const offer = this.buildOffer(first, segments, stops, params);
        offer.id = `${first.id}_${second.id}`;
        offer.price.total = totalPrice.toFixed(2);
        offer.price.base = totalPrice.toFixed(2);
        offer.price.grandTotal = totalPrice.toFixed(2);

        results.push(offer);
      }
    }

    return results;
  }

  private buildOffer(
    instance: FlightInstanceWithRelations,
    segments: BuiltSegment[],
    stops: number,
    params: FlightSearchParams,
    isOneWay: boolean = true,
  ) {
    const itineraryDuration = this.calculateItineraryDuration(segments);

    const lastTicketingDate = new Date(instance.departureDate);
    lastTicketingDate.setDate(lastTicketingDate.getDate() - 1);

    const pricing = this.calculateTotalPrice(instance, params.passengers, params.travelClass);

    return {
      type: 'flight-offer',
      id: instance.id,
      source: 'GDS',
      instantTicketingRequired: false,
      nonHomogeneous: false,
      oneWay: isOneWay,
      lastTicketingDate: lastTicketingDate.toISOString().split('T')[0],
      numberOfBookableSeats: instance.seatsAvailable,
      itineraries: [
        {
          duration: itineraryDuration,
          segments: segments.map((s) => ({
            ...s,
            numberOfStops: stops,
          })),
        },
      ],
      price: {
        currency: pricing.currency,
        total: pricing.total.toFixed(2),
        base: pricing.total.toFixed(2),
        grandTotal: pricing.total.toFixed(2),
        fees: [],
      },
      travelerPricings: this.buildTravelerPricings(
        params.passengers,
        segments,
        instance,
        params.travelClass,
      ),
    };
  }

  private buildSegments(
    segments: FlightSegmentWithRelations[],
    instance: FlightInstanceWithRelations,
  ): BuiltSegment[] {
    const builtSegments: BuiltSegment[] = [];
    let departureAt = new Date(instance.departureDate);

    for (const segment of segments) {
      const arrivalAt = new Date(departureAt.getTime() + segment.durationMinutes * 60000);

      builtSegments.push({
        id: segment.id,
        flightInstanceId: instance.id,

        departure: {
          iataCode: segment.departureAirport.iataCode,
          at: departureAt.toISOString(),
        },

        arrival: {
          iataCode: segment.arrivalAirport.iataCode,
          at: arrivalAt.toISOString(),
        },

        carrierCode: segment.carrierCode,
        number: segment.flightNumber,

        aircraft: {
          code: segment.aircraft?.code ?? null,
        },

        operating: {
          carrierCode: segment.carrierCode,
        },

        duration: this.formatDuration(segment.durationMinutes),

        blacklistedInEU: false,
      });

      departureAt = arrivalAt;
    }

    return builtSegments;
  }

  private calculateItineraryDuration(segments: BuiltSegment[]) {
    const first = new Date(segments[0].departure.at).getTime();
    const last = new Date(segments[segments.length - 1].arrival.at).getTime();

    const minutes = Math.floor((last - first) / 60000);

    return this.formatDuration(minutes);
  }

  private formatDuration(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (m === 0) return `PT${h}H`;

    return `PT${h}H${m}M`;
  }

  private buildTravelerPricings(
    passengers: PassengerCounts,
    segments: BuiltSegment[],
    instance: FlightInstanceWithRelations,
    travelClass: TravelClass,
  ) {
    const travelers: FlightOffersResponse['data'][number]['travelerPricings'] = [];

    const classMap = {
      ECONOMY: 'Y',
      PREMIUM_ECONOMY: 'W',
      BUSINESS: 'J',
      FIRST: 'F',
    };

    const bookingClass = classMap[travelClass];

    let travelerId = 1;

    const buildFareSegments = (checkedBags: number, fareBasis?: string) =>
      segments.map((s) => ({
        segmentId: s.id,
        cabin: travelClass,
        class: bookingClass,
        fareBasis: fareBasis ?? `${bookingClass}MOCK`,
        includedCheckedBags: {
          quantity: checkedBags,
        },
      }));

    const createTravelers = (count: number, type: PassengerType) => {
      const fare = this.getFare(instance, type, travelClass);

      if (!fare) {
        return;
      }

      for (let i = 0; i < count; i++) {
        travelers.push({
          travelerId: String(travelerId++),
          fareOption: 'STANDARD',
          travelerType: type,
          price: {
            currency: fare.currency,
            total: Number(fare.basePrice).toFixed(2),
            base: Number(fare.basePrice).toFixed(2),
          },
          fareDetailsBySegment: buildFareSegments(fare.checkedBags, fare.fareBasis ?? undefined),
        });
      }
    };

    createTravelers(passengers.adults ?? 0, 'ADULT');
    createTravelers(passengers.children ?? 0, 'CHILD');
    createTravelers(passengers.infants ?? 0, 'HELD_INFANT');

    return travelers;
  }

  private getFare(
    instance: FlightInstanceWithRelations,
    passengerType: PassengerType,
    travelClass: TravelClass,
  ) {
    return instance.fares.find(
      (fare) => fare.passengerType === passengerType && fare.travelClass === travelClass,
    );
  }

  private calculateTotalPrice(
    instance: FlightInstanceWithRelations,
    passengers: PassengerCounts,
    travelClass: TravelClass,
  ) {
    const adultFare = this.getFare(instance, 'ADULT', travelClass);
    const childFare = this.getFare(instance, 'CHILD', travelClass);
    const infantFare = this.getFare(instance, 'HELD_INFANT', travelClass);

    let total = 0;
    let currency = 'USD';

    if (adultFare) {
      total += Number(adultFare.basePrice) * (passengers.adults ?? 0);
      currency = adultFare.currency;
    }

    if (childFare) {
      total += Number(childFare.basePrice) * (passengers.children ?? 0);
      currency = childFare.currency;
    }

    if (infantFare) {
      total += Number(infantFare.basePrice) * (passengers.infants ?? 0);
      currency = infantFare.currency;
    }

    return {
      total,
      currency,
    };
  }
}
