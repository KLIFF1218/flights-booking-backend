import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  FlightOffersResponse,
  FlightSearchParams,
  FlightOffer,
  Itinerary,
} from '../../interfaces/flight-offers.interface';
import { formatDuration } from '../../utils/datetime/time.util';
import { buildTimeline } from '../../utils/datetime/timeline.util';
import { FlightInstanceWithRelations } from '../../providers/prisma/flight-instance.type';
import { flightInstanceInclude } from '../../providers/prisma/flight-instance.include';
import { combineTravelerPricings } from '../../utils/pricing/traveler-pricing.util';
import { mergeLegOfferPrices } from '../../utils/pricing/fare-charges.util';
import { isCyclicRoute } from '../../utils/search/route.util';
import { Airport, FlightStatus } from '@prisma/client';
import { buildOneWayOffers } from '../../utils/offer/offer-builder.util';
import {
  buildConnectionLegs,
  mergeRoundTripLegs,
} from '../../utils/offer/offer-flight-instances.util';
import { countSeatsRequired } from 'src/shared/booking/passenger-counts.util';
import { parseDuration } from '../../utils/datetime/duration.util';
import { assertValidRoundTripDirections } from '../../utils/search/validate-search-directions.util';
import {
  buildDepartureSearchWindow,
  matchesLocalDate,
} from 'src/shared/datetime/timezone-date.util';
import {
  getMinTurnaroundMinutes,
  meetsMinimumTurnaround,
} from '../../utils/search/turnaround.util';
import { resolveDefaultSearchCurrency } from 'src/shared/currency/payment-defaults.util';

const MIN_CONNECTION_MINUTES = 45;
const MAX_CONNECTION_MINUTES = 6 * 60;
const ONE_WAY_MAX_CACHED_OFFERS = 500;
const ROUND_TRIP_MAX_CACHED_OFFERS = 500;
const ROUND_TRIP_MAX_PER_LEG_OFFERS = 50;

function resolveMaxCachedOffers(limit: number, maxCachedOffers: number): number {
  return Math.min(Math.max(limit * 25, limit), maxCachedOffers);
}

@Injectable()
export class DbFlightsSearchProvider {
  private static readonly AIRPORT_CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly airportCache = new Map<string, { airport: Airport; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  private async getCachedAirport(code: string): Promise<Airport | null> {
    const cached = DbFlightsSearchProvider.airportCache.get(code);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.airport;
    }

    const airport = await this.prisma.airport.findUnique({
      where: { iataCode: code },
    });

    if (airport) {
      DbFlightsSearchProvider.airportCache.set(code, {
        airport,
        expiresAt: Date.now() + DbFlightsSearchProvider.AIRPORT_CACHE_TTL_MS,
      });
    }

    return airport;
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    if (params.directions.length === 1) {
      return this.searchOneWayFlights(params);
    } else if (params.directions.length === 2) {
      return this.searchRoundTripFlights(params);
    } else {
      throw new BadRequestException('Only one-way and round-trip searches are supported');
    }
  }

  private async searchOneWayFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    const direction = params.directions[0];
    const seatsRequired = countSeatsRequired(params.passengers);

    const targetCurrency = params.currencyCode ?? resolveDefaultSearchCurrency();
    const limit = params.limit ?? 20;
    const maxCachedOffers = resolveMaxCachedOffers(limit, ONE_WAY_MAX_CACHED_OFFERS);

    const [depAirport, arrAirport] = await Promise.all([
      this.getCachedAirport(direction.origin),
      this.getCachedAirport(direction.destination),
    ]);

    if (!depAirport || !arrAirport) {
      return { data: [], meta: { count: 0 } };
    }

    const departureTimeZone = depAirport.timezone || 'UTC';
    const { dbStart, dbEnd } = buildDepartureSearchWindow(direction.dateFrom, departureTimeZone);
    const { dbEnd: secondLegDbEnd } = buildDepartureSearchWindow(
      direction.dateFrom,
      departureTimeZone,
      1,
    );

    const directInstances = await this.prisma.flightInstance.findMany({
      where: {
        departureDate: {
          gte: dbStart,
          lt: dbEnd,
        },
        status: {
          in: [FlightStatus.SCHEDULED, FlightStatus.DELAYED],
        },
        flight: {
          departureAirport: {
            iataCode: direction.origin,
          },
          arrivalAirport: {
            iataCode: direction.destination,
          },
        },
        seatsAvailable: {
          gte: seatsRequired,
        },
      },
      include: flightInstanceInclude,
    });

    const matchedDirects = directInstances.filter((instance) => {
      const timeZone = instance.flight.departureAirport.timezone || 'UTC';
      return matchesLocalDate(new Date(instance.departureDate), timeZone, direction.dateFrom);
    });

    const offerCache = new Map<string, FlightOffer>();

    const directOffers = buildOneWayOffers(
      matchedDirects,
      params.passengers,
      params.travelClass,
      targetCurrency,
      offerCache,
    );

    const firstLegCandidates = await this.prisma.flightInstance.findMany({
      where: {
        departureDate: {
          gte: dbStart,
          lt: dbEnd,
        },
        status: {
          in: [FlightStatus.SCHEDULED, FlightStatus.DELAYED],
        },
        flight: {
          departureAirport: {
            iataCode: direction.origin,
          },
        },
        seatsAvailable: {
          gte: seatsRequired,
        },
      },
      include: flightInstanceInclude,
    });

    const secondLegCandidates = await this.prisma.flightInstance.findMany({
      where: {
        departureDate: {
          gte: dbStart,
          lt: secondLegDbEnd,
        },
        status: {
          in: [FlightStatus.SCHEDULED, FlightStatus.DELAYED],
        },
        flight: {
          arrivalAirport: {
            iataCode: direction.destination,
          },
        },
        seatsAvailable: {
          gte: seatsRequired,
        },
      },
      include: flightInstanceInclude,
    });

    const secondLegsByDepAirport = new Map<string, FlightInstanceWithRelations[]>();
    for (const second of secondLegCandidates) {
      const depCode = second.flight.departureAirport.iataCode;
      let list = secondLegsByDepAirport.get(depCode);
      if (!list) {
        list = [];
        secondLegsByDepAirport.set(depCode, list);
      }
      list.push(second);
    }

    const connectionOffers: FlightOffer[] = [];

    for (const first of firstLegCandidates) {
      const timeZone = first.flight.departureAirport.timezone || 'UTC';
      if (!matchesLocalDate(new Date(first.departureDate), timeZone, direction.dateFrom)) {
        continue;
      }

      const firstTimeline = buildTimeline(first);
      if (firstTimeline.length === 0) continue;
      const firstArrival = firstTimeline[firstTimeline.length - 1].arrivalAt;

      const potentialSeconds =
        secondLegsByDepAirport.get(first.flight.arrivalAirport.iataCode) || [];

      for (const second of potentialSeconds) {
        const secondDeparture = new Date(second.departureDate);
        const layoverMinutes = (secondDeparture.getTime() - firstArrival.getTime()) / 60000;

        if (layoverMinutes >= MIN_CONNECTION_MINUTES && layoverMinutes <= MAX_CONNECTION_MINUTES) {
          const airportRoute = [
            first.flight.departureAirport.iataCode,
            first.flight.arrivalAirport.iataCode,
            second.flight.arrivalAirport.iataCode,
          ];
          if (isCyclicRoute(airportRoute)) {
            continue;
          }

          let firstOffer = offerCache.get(first.id);
          if (!firstOffer) {
            const built = buildOneWayOffers(
              [first],
              params.passengers,
              params.travelClass,
              targetCurrency,
              offerCache,
            )[0];
            if (built) {
              firstOffer = built;
              offerCache.set(first.id, firstOffer);
            }
          }

          let secondOffer = offerCache.get(second.id);
          if (!secondOffer) {
            const built = buildOneWayOffers(
              [second],
              params.passengers,
              params.travelClass,
              targetCurrency,
              offerCache,
            )[0];
            if (built) {
              secondOffer = built;
              offerCache.set(second.id, secondOffer);
            }
          }

          if (!firstOffer || !secondOffer) continue;

          const secondTimeline = buildTimeline(second);
          if (secondTimeline.length === 0) continue;
          const secondArrival = secondTimeline[secondTimeline.length - 1].arrivalAt;

          const combinedPrice = mergeLegOfferPrices(
            firstOffer.price,
            secondOffer.price,
            seatsRequired,
          );

          const itinerary: Itinerary = {
            duration: formatDuration(
              Math.floor(
                (secondArrival.getTime() - new Date(first.departureDate).getTime()) / 60000,
              ),
            ),
            segments: [
              ...firstOffer.itineraries[0].segments,
              ...secondOffer.itineraries[0].segments,
            ],
          };

          connectionOffers.push({
            id: `${first.id}_${second.id}`,
            source: firstOffer.source,
            fareBrand: firstOffer.fareBrand,
            changeable: firstOffer.changeable,
            refundable: firstOffer.refundable,
            currencyCode: targetCurrency,
            legs: buildConnectionLegs(first.id, second.id),
            numberOfBookableSeats: Math.min(first.seatsAvailable, second.seatsAvailable),
            itineraries: [itinerary],
            price: combinedPrice,
            travelerPricings: combineTravelerPricings(
              firstOffer.travelerPricings || [],
              secondOffer.travelerPricings || [],
            ),
          });
        }
      }
    }

    const allOffers = [...directOffers, ...connectionOffers];
    const cappedOffers = this.selectTopLegOffers(allOffers, maxCachedOffers);

    return {
      data: cappedOffers,
      meta: {
        count: cappedOffers.length,
      },
    };
  }

  private async searchRoundTripFlights(params: FlightSearchParams): Promise<FlightOffersResponse> {
    const limit = params.limit ?? 20;
    const targetCurrency = params.currencyCode ?? resolveDefaultSearchCurrency();

    assertValidRoundTripDirections(params.directions[0], params.directions[1]);

    const [outboundOriginAirport, outboundDestinationAirport] = await Promise.all([
      this.getCachedAirport(params.directions[0].origin),
      this.getCachedAirport(params.directions[0].destination),
    ]);

    if (!outboundOriginAirport || !outboundDestinationAirport) {
      return { data: [], meta: { count: 0 } };
    }

    const minTurnaroundMinutes = getMinTurnaroundMinutes(
      outboundOriginAirport.country,
      outboundDestinationAirport.country,
    );

    const globalCap = resolveMaxCachedOffers(limit, ROUND_TRIP_MAX_CACHED_OFFERS);
    const perLegCap = Math.min(
      ROUND_TRIP_MAX_PER_LEG_OFFERS,
      Math.max(limit, Math.ceil(Math.sqrt(globalCap * 2))),
    );

    const outboundParams: FlightSearchParams = { ...params, directions: [params.directions[0]] };
    const returnParams: FlightSearchParams = { ...params, directions: [params.directions[1]] };

    const [outboundOffers, returnOffers] = await Promise.all([
      this.searchOneWayFlights(outboundParams),
      this.searchOneWayFlights(returnParams),
    ]);

    const outboundCandidates = this.selectTopLegOffers(outboundOffers.data, perLegCap);
    const returnCandidates = this.selectTopLegOffers(returnOffers.data, perLegCap);
    const seatsRequired = countSeatsRequired(params.passengers);

    const combinedOffers: FlightOffer[] = [];

    for (const outbound of outboundCandidates) {
      const outboundArrivalDate = this.getOfferArrivalDate(outbound);
      if (!outboundArrivalDate) {
        continue;
      }

      for (const returnFlight of returnCandidates) {
        const returnDepartureDate = this.getOfferDepartureDate(returnFlight);
        if (!returnDepartureDate) {
          continue;
        }

        if (
          !meetsMinimumTurnaround(outboundArrivalDate, returnDepartureDate, minTurnaroundMinutes)
        ) {
          continue;
        }

        combinedOffers.push(
          this.buildRoundTripOffer(outbound, returnFlight, targetCurrency, seatsRequired),
        );
      }
    }

    combinedOffers.sort((a, b) => this.compareOffersByPriceAndDuration(a, b));
    const cappedOffers = combinedOffers.slice(0, globalCap);

    return {
      data: cappedOffers,
      meta: {
        count: cappedOffers.length,
      },
    };
  }

  private buildRoundTripOffer(
    outbound: FlightOffer,
    returnFlight: FlightOffer,
    targetCurrency: typeof outbound.price.currency,
    seatsRequired: number,
  ): FlightOffer {
    const combinedPrice = mergeLegOfferPrices(outbound.price, returnFlight.price, seatsRequired);

    return {
      id: `${outbound.id}_${returnFlight.id}`,
      source: outbound.source,
      fareBrand: outbound.fareBrand,
      changeable: outbound.changeable && returnFlight.changeable,
      refundable: outbound.refundable && returnFlight.refundable,
      currencyCode: targetCurrency,
      legs: mergeRoundTripLegs(outbound, returnFlight),
      numberOfBookableSeats: Math.min(
        outbound.numberOfBookableSeats,
        returnFlight.numberOfBookableSeats,
      ),
      itineraries: [...outbound.itineraries, ...returnFlight.itineraries],
      price: combinedPrice,
      travelerPricings: combineTravelerPricings(
        outbound.travelerPricings || [],
        returnFlight.travelerPricings || [],
      ),
    };
  }

  private selectTopLegOffers(offers: FlightOffer[], maxCount: number): FlightOffer[] {
    if (offers.length <= maxCount) {
      return offers;
    }

    return [...offers]
      .sort((a, b) => this.compareOffersByPriceAndDuration(a, b))
      .slice(0, maxCount);
  }

  private compareOffersByPriceAndDuration(a: FlightOffer, b: FlightOffer): number {
    const priceDiff = Number(a.price.total) - Number(b.price.total);
    if (priceDiff !== 0) {
      return priceDiff;
    }

    return this.getOfferTotalDurationMinutes(a) - this.getOfferTotalDurationMinutes(b);
  }

  private getOfferTotalDurationMinutes(offer: FlightOffer): number {
    return offer.itineraries.reduce((sum, itinerary) => sum + parseDuration(itinerary.duration), 0);
  }

  private getOfferArrivalDate(offer: FlightOffer): Date | null {
    const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
    const lastSegment = lastItinerary?.segments[lastItinerary.segments.length - 1];
    return lastSegment ? new Date(lastSegment.arrival.at) : null;
  }

  private getOfferDepartureDate(offer: FlightOffer): Date | null {
    const firstSegment = offer.itineraries[0]?.segments[0];
    return firstSegment ? new Date(firstSegment.departure.at) : null;
  }
}
