import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FlightsSearchStore } from './flights-cache.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { FlightPricingResponse, SeatOptionDto } from '../dtos';
import { mapItinerary } from '../utils/itinerary.mapper';
import { CalculateSeatPrice } from './calculate-seatprice.service';
import { Currency, FareBrand, PassengerType } from '@prisma/client';
import {
  assertPassengerCountsMatchSearch,
  countSeatsRequired,
  normalizePassengerCounts,
  validatePassengerCounts,
} from '../utils/passenger-counts.util';
import { FlightInstanceWithFares } from '../types/flights.types';
import { Logger } from 'nestjs-pino';
import { convertCurrencyWithRates } from '../utils/currency.util';
import { buildFarePriceBreakdown, formatOfferPrice } from '../utils/fare-charges.util';
import { buildTravelerPriceFromBase } from '../utils/traveler-pricing.util';
import {
  createPricingQuoteMeta,
  PRICING_QUOTE_TTL_SECONDS,
  PRICING_QUOTE_WITH_SEATS_TTL_SECONDS,
} from '../utils/pricing-quote.util';
import { CurrencyRatesService } from './currency-rates.service';
import { flightInstanceInclude } from '../providers/prisma/flight-instance.include';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import {
  applyInstanceSchedulesToOffer,
  assertFlightInstancesBookable,
} from '../utils/offer-schedule.util';
import type { FlightPricingProvider } from '../providers/flight-pricing.provider';
import {
  DEFAULT_SEARCH_FARE_BRAND,
  isFareBrand,
  OFFER_SOURCE_INTERNAL_DB,
  PRICING_MODE_INDICATIVE,
  resolveFareBrandRules,
} from '../constants/fare-brand.constants';
import type { FlightOffer } from '../interfaces/flight-offers.interface';

@Injectable()
export class DbPricingProvider implements FlightPricingProvider {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly prisma: PrismaService,
    private readonly calculateSeatPrice: CalculateSeatPrice,
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly logger: Logger,
  ) {}

  async price(
    searchId: string,
    offerId: string,
    options?: {
      seats?: SeatOptionDto[];
      adults?: number;
      children?: number;
      infants?: number;
      seatedInfants?: number;
      currencyCode?: Currency;
      lockedFxRates?: Record<string, number>;
      fareBrand?: FareBrand;
      bookingId?: string;
    },
  ): Promise<FlightPricingResponse> {
    const cachedOffer = await this.searchStore.getOfferWithContext(searchId, offerId);
    if (!cachedOffer) {
      throw new NotFoundException('Offer not found');
    }

    const { offer, context: searchContext } = cachedOffer;

    const fxRates =
      options?.lockedFxRates ?? (await this.currencyRatesService.syncRatesFromRedis());
    const fxRatesAt = new Date().toISOString();
    const convert = (amount: number, from: string, to: string) =>
      convertCurrencyWithRates(amount, from, to, fxRates);

    const offerCurrency = offer.currencyCode ?? offer.price.currency;
    const targetCurrency = options?.currencyCode ?? offerCurrency;

    const pricedOffer = structuredClone(offer);

    const flightInstanceIds = offer.itineraries.flatMap((itinerary) =>
      itinerary.segments.map((segment) => segment.flightInstanceId),
    );

    const uniqueFlightInstanceIds = [...new Set(flightInstanceIds)];

    const uniqueInstances = await this.prisma.flightInstance.findMany({
      where: {
        id: { in: uniqueFlightInstanceIds },
      },
      include: flightInstanceInclude,
    });

    const instancesMap = new Map(uniqueInstances.map((instance) => [instance.id, instance])) as Map<
      string,
      FlightInstanceWithRelations
    >;

    for (const id of flightInstanceIds) {
      if (!instancesMap.has(id)) {
        throw new NotFoundException(`Flight instance ${id} not found`);
      }
    }

    assertFlightInstancesBookable(uniqueInstances);

    const scheduleSnapshot = applyInstanceSchedulesToOffer(offer, instancesMap);
    const scheduleAwareOffer = scheduleSnapshot.offer;

    const pricingInstances = uniqueFlightInstanceIds.map(
      (id) => instancesMap.get(id)!,
    ) as FlightInstanceWithFares[];

    const firstFare = pricingInstances[0]?.fares?.[0];
    if (!firstFare) {
      throw new NotFoundException('Fare currency not found');
    }
    const fareCurrency = firstFare.currency;

    for (const inst of pricingInstances) {
      for (const fare of inst.fares) {
        if (fare.currency !== fareCurrency) {
          throw new BadRequestException(
            `Currency mismatch in flight fares. Expected ${fareCurrency}, but found ${fare.currency} on instance ${inst.id}`,
          );
        }
      }
    }

    const lastPricing = await this.searchStore.getLastPricing(searchId, offerId);
    this.logger.debug({ searchId, offerId, hasLastPricing: !!lastPricing }, 'Loaded last pricing');

    const searchPassengers = searchContext
      ? searchContext.passengers
      : this.inferPassengersFromOffer(offer);

    const hasPassengerUpdate =
      options?.adults !== undefined ||
      options?.children !== undefined ||
      options?.infants !== undefined ||
      options?.seatedInfants !== undefined;

    if (hasPassengerUpdate) {
      assertPassengerCountsMatchSearch(
        {
          adults: options?.adults ?? searchPassengers.adults,
          children: options?.children ?? searchPassengers.children,
          infants: options?.infants ?? searchPassengers.infants,
          seatedInfants: options?.seatedInfants ?? searchPassengers.seatedInfants,
        },
        searchPassengers,
      );
    }

    let adults = searchPassengers.adults;
    let children = searchPassengers.children;
    let infants = searchPassengers.infants;
    let seatedInfants = searchPassengers.seatedInfants;

    if (!hasPassengerUpdate && lastPricing) {
      adults = lastPricing.travelers.filter((t) => t.travelerType === PassengerType.ADULT).length;
      children = lastPricing.travelers.filter((t) => t.travelerType === PassengerType.CHILD).length;
      infants = lastPricing.travelers.filter(
        (t) => t.travelerType === PassengerType.HELD_INFANT,
      ).length;
      seatedInfants = lastPricing.travelers.filter(
        (t) => t.travelerType === PassengerType.SEATED_INFANT,
      ).length;

      assertPassengerCountsMatchSearch(
        { adults, children, infants, seatedInfants },
        searchPassengers,
      );
    }

    const validated = validatePassengerCounts({ adults, children, infants, seatedInfants });
    adults = validated.adults;
    children = validated.children;
    infants = validated.infants;
    seatedInfants = validated.seatedInfants;

    const seatsRequired = countSeatsRequired({ adults, children, infants, seatedInfants });
    const passengerCounts = {
      ADULT: adults,
      CHILD: children,
      HELD_INFANT: infants,
      SEATED_INFANT: seatedInfants,
    };

    const firstFareDetail = scheduleAwareOffer.travelerPricings?.[0]?.fareDetailsBySegment?.[0];
    if (!firstFareDetail) {
      throw new BadRequestException('Fare details not found');
    }
    const travelClass = firstFareDetail.cabin as
      | 'ECONOMY'
      | 'PREMIUM_ECONOMY'
      | 'BUSINESS'
      | 'FIRST';

    if (searchContext && searchContext.travelClass !== travelClass) {
      throw new BadRequestException(
        'Offer travel class does not match the original search. Start a new search.',
      );
    }

    const minSeatsAvailable = Math.min(
      ...pricingInstances.map((instance) => instance.seatsAvailable),
    );
    if (minSeatsAvailable < seatsRequired) {
      throw new BadRequestException('Not enough seats available');
    }

    const fareBrand = isFareBrand(options?.fareBrand)
      ? options.fareBrand
      : this.resolveOfferFareBrand(scheduleAwareOffer);
    const brandRules = resolveFareBrandRules(fareBrand, travelClass);

    let basePrice = 0;
    for (const instance of pricingInstances) {
      for (const [type, count] of Object.entries(passengerCounts)) {
        if (!count) continue;
        const fare = instance.fares.find(
          (f) =>
            f.passengerType === type &&
            f.travelClass === travelClass &&
            f.fareBrand === fareBrand,
        );
        if (!fare) {
          throw new NotFoundException(
            `Fare not found for ${type} ${travelClass} ${fareBrand}`,
          );
        }
        const convertedPrice = convert(Number(fare.basePrice), fare.currency, targetCurrency);
        basePrice += convertedPrice * count;
      }
    }

    const fareBreakdown = buildFarePriceBreakdown(basePrice, seatsRequired);

    const seatPrice = await this.calculateSeatPrice.calculateSeatPrice(
      scheduleAwareOffer,
      options?.seats ?? [],
      fareCurrency,
      targetCurrency,
      fxRates,
      options?.bookingId,
    );

    const totalPrice = fareBreakdown.total + seatPrice;

    pricedOffer.price = formatOfferPrice(targetCurrency, fareBreakdown);
    pricedOffer.price.total = totalPrice.toFixed(2);
    pricedOffer.price.grandTotal = totalPrice.toFixed(2);

    const allSegments = scheduleAwareOffer.itineraries.flatMap((itinerary) => itinerary.segments);

    const travelerPricings = this.buildTravelerPricings(
      { adults, children, infants, seatedInfants },
      allSegments,
      instancesMap,
      pricingInstances,
      travelClass,
      targetCurrency,
      convert,
      fareBrand,
    );

    pricedOffer.source = OFFER_SOURCE_INTERNAL_DB;
    pricedOffer.fareBrand = fareBrand;
    pricedOffer.changeable = brandRules.changeable;
    pricedOffer.refundable = brandRules.refundable;
    pricedOffer.travelerPricings = travelerPricings;

    const cachedOfferUpdate: FlightOffer = {
      ...scheduleAwareOffer,
      currencyCode: targetCurrency,
      price: pricedOffer.price,
      travelerPricings: pricedOffer.travelerPricings,
      source: OFFER_SOURCE_INTERNAL_DB,
      fareBrand,
      changeable: brandRules.changeable,
      refundable: brandRules.refundable,
    };

    await this.searchStore.replaceOfferInSearch(searchId, offerId, cachedOfferUpdate);

    const selectedSeats = options?.seats ?? [];
    const quoteMeta = createPricingQuoteMeta(
      selectedSeats.length > 0 ? PRICING_QUOTE_WITH_SEATS_TTL_SECONDS : PRICING_QUOTE_TTL_SECONDS,
    );

    const flightPricing: FlightPricingResponse = {
      id: pricedOffer.id,
      ...quoteMeta,
      source: OFFER_SOURCE_INTERNAL_DB,
      pricingMode: PRICING_MODE_INDICATIVE,
      fareBrand,
      price: {
        base: fareBreakdown.base,
        taxes: fareBreakdown.taxTotal,
        fees: fareBreakdown.feeTotal,
        taxItems: fareBreakdown.taxes,
        feeItems: fareBreakdown.fees,
        seats: seatPrice,
        total: totalPrice,
        currency: targetCurrency,
      },
      travelers: travelerPricings,
      outbound: mapItinerary(scheduleAwareOffer.itineraries[0]),
      inbound: scheduleAwareOffer.itineraries[1]
        ? mapItinerary(scheduleAwareOffer.itineraries[1])
        : undefined,
      scheduleChanged: scheduleSnapshot.scheduleChanged,
      operationalStatus: scheduleSnapshot.operationalStatus,
      delayMinutes: scheduleSnapshot.delayMinutes,
      scheduleChanges: scheduleSnapshot.scheduleChanges,
      fxRates,
      fxRatesAt,
      seatsPricingMode: selectedSeats.length > 0 ? PRICING_MODE_INDICATIVE : undefined,
    };

    await this.searchStore.saveLastPricing(searchId, offerId, flightPricing);
    return flightPricing;
  }

  private resolveOfferFareBrand(offer: FlightOffer): FareBrand {
    if (isFareBrand(offer.fareBrand)) {
      return offer.fareBrand;
    }

    const fromTraveler = offer.travelerPricings?.[0]?.fareOption;
    if (isFareBrand(fromTraveler)) {
      return fromTraveler;
    }

    const fromSegment = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.brandName;
    if (isFareBrand(fromSegment)) {
      return fromSegment;
    }

    return DEFAULT_SEARCH_FARE_BRAND;
  }

  private buildTravelerPricings(
    passengers: {
      adults?: number;
      children?: number;
      infants?: number;
      seatedInfants?: number;
    },
    segments: { id: string; flightInstanceId: string }[],
    instancesMap: Map<string, FlightInstanceWithFares>,
    pricingInstances: FlightInstanceWithFares[],
    travelClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST',
    currency: Currency,
    convert: (amount: number, from: string, to: string) => number,
    fareBrand: FareBrand,
  ) {
    type FarePassengerType = 'ADULT' | 'CHILD' | 'HELD_INFANT' | 'SEATED_INFANT';
    const travelers: FlightPricingResponse['travelers'] = [];

    const classMap = {
      ECONOMY: 'Y',
      PREMIUM_ECONOMY: 'W',
      BUSINESS: 'J',
      FIRST: 'F',
    };

    const bookingClass = classMap[travelClass];
    let travelerId = 1;

    const buildFareSegments = (passengerType: FarePassengerType) =>
      segments.map((segment) => {
        const instance = instancesMap.get(segment.flightInstanceId);
        if (!instance) {
          throw new NotFoundException(`Flight instance ${segment.flightInstanceId} not found`);
        }

        const fare = instance.fares.find(
          (f) =>
            f.passengerType === passengerType &&
            f.travelClass === travelClass &&
            f.fareBrand === fareBrand,
        );

        if (!fare) {
          throw new NotFoundException(`Fare not found for ${passengerType} ${fareBrand}`);
        }

        return {
          segmentId: segment.id,
          cabin: travelClass,
          class: bookingClass,
          fareBasis: fare.fareBasis ?? null,
          includedCheckedBags: {
            quantity: fare.checkedBags,
          },
          brandName: fare.fareBrand,
          changeable: fare.changeable,
          refundable: fare.refundable,
        };
      });

    const calculatePassengerPrice = (passengerType: FarePassengerType) => {
      let total = 0;
      for (const instance of pricingInstances) {
        const fare = instance.fares.find(
          (f) =>
            f.passengerType === passengerType &&
            f.travelClass === travelClass &&
            f.fareBrand === fareBrand,
        );

        if (!fare) {
          throw new NotFoundException(`Fare not found for ${passengerType} ${fareBrand}`);
        }

        total += convert(Number(fare.basePrice), fare.currency, currency);
      }
      return total;
    };

    const createTraveler = (type: PassengerType, fareType: FarePassengerType) => {
      const base = calculatePassengerPrice(fareType);

      return {
        travelerId: String(travelerId++),
        fareOption: fareBrand,
        travelerType: type,
        price: buildTravelerPriceFromBase(base, type, currency),
        fareDetailsBySegment: buildFareSegments(fareType),
      };
    };

    for (let i = 0; i < (passengers.adults ?? 0); i++) {
      travelers.push(createTraveler(PassengerType.ADULT, 'ADULT'));
    }

    for (let i = 0; i < (passengers.children ?? 0); i++) {
      travelers.push(createTraveler(PassengerType.CHILD, 'CHILD'));
    }

    for (let i = 0; i < (passengers.infants ?? 0); i++) {
      travelers.push(createTraveler(PassengerType.HELD_INFANT, 'HELD_INFANT'));
    }

    for (let i = 0; i < (passengers.seatedInfants ?? 0); i++) {
      travelers.push(createTraveler(PassengerType.SEATED_INFANT, 'SEATED_INFANT'));
    }

    return travelers;
  }

  private inferPassengersFromOffer(offer: {
    travelerPricings?: Array<{ travelerType: PassengerType }>;
  }) {
    return normalizePassengerCounts({
      adults:
        offer.travelerPricings?.filter((t) => t.travelerType === PassengerType.ADULT).length ?? 0,
      children:
        offer.travelerPricings?.filter((t) => t.travelerType === PassengerType.CHILD).length ?? 0,
      infants:
        offer.travelerPricings?.filter((t) => t.travelerType === PassengerType.HELD_INFANT)
          .length ?? 0,
      seatedInfants:
        offer.travelerPricings?.filter((t) => t.travelerType === PassengerType.SEATED_INFANT)
          .length ?? 0,
    });
  }
}
