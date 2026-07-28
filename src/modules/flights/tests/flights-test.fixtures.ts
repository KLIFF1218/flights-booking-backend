import {
  Currency,
  FareBrand,
  FlightStatus,
  PassengerType,
  Prisma,
  TravelClass,
} from '@prisma/client';
import type { FlightOffer } from '../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../providers/prisma/flight-instance.type';
import { OFFER_SOURCE_INTERNAL_DB } from '../constants/fare-brand.constants';

export function buildAirport(iataCode: string, timezone: string, country = 'US') {
  return {
    iataCode,
    timezone,
    country,
    name: iataCode,
    city: iataCode,
  };
}

export function buildFlightFares(instanceId: string) {
  const now = new Date();
  return [
    {
      id: `fare-${instanceId}`,
      flightInstanceId: instanceId,
      passengerType: PassengerType.ADULT,
      travelClass: TravelClass.ECONOMY,
      fareBrand: FareBrand.LIGHT,
      basePrice: new Prisma.Decimal(250),
      currency: Currency.USD,
      fareBasis: 'ECONOMY_LIGHT',
      checkedBags: 0,
      changeable: false,
      refundable: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildMockFlightInstance(opts: {
  id: string;
  departureDate: Date;
  origin: string;
  destination: string;
  seatsAvailable?: number;
  airlineCode?: string;
}): FlightInstanceWithRelations {
  const originAirport = buildAirport(
    opts.origin,
    opts.origin === 'JFK' ? 'America/New_York' : 'America/Los_Angeles',
  );
  const destinationAirport = buildAirport(
    opts.destination,
    opts.destination === 'SFO' ? 'America/Los_Angeles' : 'America/New_York',
  );

  return {
    id: opts.id,
    departureDate: opts.departureDate,
    originalDepartureDate: opts.departureDate,
    delayMinutes: 0,
    status: FlightStatus.SCHEDULED,
    seatsAvailable: opts.seatsAvailable ?? 50,
    flight: {
      id: `flight-${opts.id}`,
      durationMinutes: 360,
      airline: { code: opts.airlineCode ?? 'DL', name: 'Delta' },
      departureAirport: originAirport,
      arrivalAirport: destinationAirport,
      segments: [
        {
          id: `seg-${opts.id}`,
          segmentOrder: 0,
          dayOffset: 0,
          departureTime: '10:00',
          durationMinutes: 360,
          carrierCode: 'DL',
          flightNumber: '100',
          departureAirport: originAirport,
          arrivalAirport: destinationAirport,
          aircraft: { code: '738', name: 'Boeing 737' },
        },
      ],
    },
    fares: buildFlightFares(opts.id),
  } as unknown as FlightInstanceWithRelations;
}

export function buildCachedPricingOffer(
  instanceId: string,
  segmentId = `seg-${instanceId}`,
): FlightOffer {
  return {
    id: instanceId,
    source: OFFER_SOURCE_INTERNAL_DB,
    fareBrand: FareBrand.LIGHT,
    changeable: false,
    refundable: false,
    currencyCode: Currency.USD,
    numberOfBookableSeats: 50,
    itineraries: [
      {
        duration: 'PT6H',
        segments: [
          {
            id: segmentId,
            flightInstanceId: instanceId,
            from: 'JFK',
            to: 'SFO',
            departure: { iataCode: 'JFK', at: '2026-08-15T14:00:00.000Z' },
            arrival: { iataCode: 'SFO', at: '2026-08-15T20:00:00.000Z' },
            carrierCode: 'DL',
            number: '100',
            airline: 'Delta',
            airlineIata: 'DL',
            aircraft: '738',
            operating: { carrierCode: 'DL' },
            duration: 'PT6H',
            blacklistedInEU: false,
          },
        ],
      },
    ],
    price: {
      total: '300.00',
      currency: Currency.USD,
      base: '250.00',
      grandTotal: '300.00',
    },
    travelerPricings: [
      {
        travelerId: '1',
        fareOption: FareBrand.LIGHT,
        travelerType: PassengerType.ADULT,
        price: {
          total: '300.00',
          currency: Currency.USD,
          base: '250.00',
        },
        fareDetailsBySegment: [
          {
            segmentId,
            cabin: TravelClass.ECONOMY,
            class: 'Y',
            fareBasis: 'ECONOMY_LIGHT',
            includedCheckedBags: { quantity: 0 },
            brandName: FareBrand.LIGHT,
            changeable: false,
            refundable: false,
          },
        ],
      },
    ],
  };
}
