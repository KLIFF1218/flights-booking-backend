import type { PassengerType, TravelClass, Traveler } from '@prisma/client';
import type { EticketDocumentData, EticketSegmentRow } from 'src/infra/pdf/eticket.types';
import type { FlightTraveler } from 'src/modules/flights/dtos/flight-pricing.response.dto';
import type { FareDetailsBySegment } from 'src/modules/flights/interfaces/flight-offers.interface';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import {
  extractItinerariesFromSnapshot,
  extractRouteFromSnapshot,
} from 'src/modules/bookings/utils/booking-snapshot.util';

const PASSENGER_TYPE_LABELS: Record<PassengerType, string> = {
  ADULT: 'Adult',
  CHILD: 'Child',
  HELD_INFANT: 'Infant on lap',
  SEATED_INFANT: 'Infant with seat',
};

const TRAVEL_CLASS_LABELS: Record<TravelClass, string> = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

const BOOKING_CLASS_BY_TRAVEL_CLASS: Record<TravelClass, string> = {
  ECONOMY: 'Y',
  PREMIUM_ECONOMY: 'W',
  BUSINESS: 'J',
  FIRST: 'F',
};

function formatEticketDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEticketTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function sumLineItems(items: Array<{ amount: string }> | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
}

function formatBaggage(quantity: number): string {
  if (quantity <= 0) {
    return 'No checked baggage';
  }

  return quantity === 1 ? '1 piece' : `${quantity} pieces`;
}

function findFareDetailsForSegment(
  travelerPricing: FlightTraveler | undefined,
  segmentId: string,
): FareDetailsBySegment | undefined {
  return travelerPricing?.fareDetailsBySegment.find((detail) => detail.segmentId === segmentId);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Allocate booking-level seat surcharge across travelers by seat assignment count. */
export function allocateSeatSurcharge(params: {
  bookingSeatsTotal: number;
  travelerSeatCount: number;
  bookingSeatAssignmentTotal: number;
}): number {
  const { bookingSeatsTotal, travelerSeatCount, bookingSeatAssignmentTotal } = params;

  if (bookingSeatsTotal <= 0 || travelerSeatCount <= 0 || bookingSeatAssignmentTotal <= 0) {
    return 0;
  }

  return roundMoney((bookingSeatsTotal * travelerSeatCount) / bookingSeatAssignmentTotal);
}

export function buildEticketDocumentData(params: {
  pnr: string;
  ticketNumber: string;
  issuedAt: Date;
  traveler: Traveler;
  snapshot: BookingSnapshot;
  travelerPricing?: FlightTraveler;
  seatBySegmentId: Map<string, string>;
  /** Seat surcharge for this passenger in booking currency (from pricing.price.seats). */
  seatSurcharge?: number;
}): EticketDocumentData {
  const {
    pnr,
    ticketNumber,
    issuedAt,
    traveler,
    snapshot,
    travelerPricing,
    seatBySegmentId,
    seatSurcharge = 0,
  } = params;

  const { origin, destination } = extractRouteFromSnapshot(snapshot);
  const itineraries = extractItinerariesFromSnapshot(snapshot);
  const bookingPrice = snapshot.pricing.price;

  const segments: EticketSegmentRow[] = itineraries.flatMap((itinerary) =>
    itinerary.segments.map((segment) => {
      const fareDetails = findFareDetailsForSegment(travelerPricing, segment.id);
      const cabin = fareDetails?.cabin ?? traveler.travelClass;
      const bookingClass =
        fareDetails?.class ?? BOOKING_CLASS_BY_TRAVEL_CLASS[traveler.travelClass];
      const baggageQuantity =
        fareDetails?.includedCheckedBags?.quantity ?? traveler.checkedBags ?? 0;

      return {
        itineraryLabel: itinerary.label,
        flight: `${segment.carrierCode} ${segment.number}`,
        departureAirport: segment.departure.iataCode,
        arrivalAirport: segment.arrival.iataCode,
        departureDate: formatEticketDate(segment.departure.at),
        departureTime: formatEticketTime(segment.departure.at),
        arrivalDate: formatEticketDate(segment.arrival.at),
        arrivalTime: formatEticketTime(segment.arrival.at),
        cabin: TRAVEL_CLASS_LABELS[cabin as TravelClass] ?? cabin,
        bookingClass,
        fareBasis: fareDetails?.fareBasis ?? traveler.fareBasis ?? '—',
        seat: seatBySegmentId.get(segment.id) ?? 'Not assigned',
        baggage: formatBaggage(baggageQuantity),
      };
    }),
  );

  const travelerBase = Number(travelerPricing?.price.base ?? traveler.basePrice);
  const travelerTaxes = sumLineItems(travelerPricing?.price.taxes);
  const travelerFees = sumLineItems(travelerPricing?.price.fees);
  const travelerSeats = roundMoney(Math.max(0, seatSurcharge));
  const fareWithoutSeats = Number(
    travelerPricing?.price.total ?? travelerBase + travelerTaxes + travelerFees,
  );
  const travelerTotal = roundMoney(fareWithoutSeats + travelerSeats);
  const currency = travelerPricing?.price.currency ?? traveler.currency;

  return {
    pnr,
    ticketNumber,
    issuedAt: formatEticketDate(issuedAt),
    passengerName: `${traveler.lastName}/${traveler.firstName}`.toUpperCase(),
    passengerType: PASSENGER_TYPE_LABELS[traveler.passengerType],
    dateOfBirth: formatEticketDate(traveler.birthDate),
    nationality: traveler.nationality,
    passportNumber: traveler.passportNumber,
    origin,
    destination,
    segments,
    fare: {
      base: formatMoney(travelerBase, currency),
      taxes: formatMoney(travelerTaxes, currency),
      fees: formatMoney(travelerFees, currency),
      seats: formatMoney(travelerSeats, currency),
      total: formatMoney(travelerTotal, currency),
      currency,
    },
    bookingTotal: formatMoney(bookingPrice.total, bookingPrice.currency),
    bookingCurrency: bookingPrice.currency,
  };
}
