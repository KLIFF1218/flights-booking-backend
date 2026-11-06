import { BadRequestException } from '@nestjs/common';
import { type PaymentProvider } from '@prisma/client';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';
import type { FlightPricingResponse } from 'src/modules/flights/dtos';
import { syncOfferScheduleFromPricing } from 'src/modules/flights/utils/offer/offer-schedule.util';
import type { BuiltSegment } from '../../types/segment.types';
import {
  DEFAULT_PAYMENT_PROVIDER,
  resolveDefaultPaymentProvider,
  SUPPORTED_PAYMENT_PROVIDERS,
} from 'src/shared/currency/payment-defaults.util';

export { DEFAULT_PAYMENT_PROVIDER, resolveDefaultPaymentProvider, SUPPORTED_PAYMENT_PROVIDERS };

export interface BookingRouteInfo {
  firstSegment: BuiltSegment;
  origin: string;
  destination: string;
}

export interface SnapshotItinerary {
  label: string;
  segments: BuiltSegment[];
}

export function extractItinerariesFromSnapshot(snapshot: BookingSnapshot): SnapshotItinerary[] {
  const itineraries = snapshot.offer?.itineraries ?? [];

  if (!itineraries.length) {
    throw new BadRequestException('Itineraries not found in booking snapshot');
  }

  return itineraries.map((itinerary, index) => {
    if (!itinerary.segments?.length) {
      throw new BadRequestException('Itinerary segments not found in booking snapshot');
    }

    let label = 'Flight';
    if (itineraries.length > 1) {
      label = index === 0 ? 'Outbound' : 'Return';
    }

    return {
      label,
      segments: itinerary.segments,
    };
  });
}

export function extractAllSegmentsFromSnapshot(snapshot: BookingSnapshot): BuiltSegment[] {
  return extractItinerariesFromSnapshot(snapshot).flatMap((itinerary) => itinerary.segments);
}

export interface BookingOfferContext {
  searchId: string;
  offerId: string;
}

export function resolveOfferContextFromSnapshot(snapshot: BookingSnapshot): BookingOfferContext {
  const searchId = snapshot.searchId;
  const offerId = snapshot.offerId ?? snapshot.offer?.id;

  if (!searchId) {
    throw new BadRequestException('Search ID not found in booking snapshot');
  }

  if (!offerId) {
    throw new BadRequestException('Offer ID not found in booking snapshot');
  }

  return { searchId, offerId };
}

export function assertOfferContextMatches(
  snapshot: BookingSnapshot,
  clientSearchId: string | undefined,
  clientOfferId: string | undefined,
): BookingOfferContext {
  const offerContext = resolveOfferContextFromSnapshot(snapshot);

  if (clientSearchId !== offerContext.searchId || clientOfferId !== offerContext.offerId) {
    throw new BadRequestException('Offer does not match booking');
  }

  return offerContext;
}

export function resolvePaymentProvider(paymentProvider?: PaymentProvider): PaymentProvider {
  return paymentProvider ?? DEFAULT_PAYMENT_PROVIDER;
}

export function assertPaymentProviderSupported(paymentProvider: PaymentProvider): void {
  if (!SUPPORTED_PAYMENT_PROVIDERS.includes(paymentProvider)) {
    throw new BadRequestException(`Unsupported payment provider: ${paymentProvider}`);
  }
}

export function resolvePaymentProviderFromSnapshot(snapshot: BookingSnapshot): PaymentProvider {
  const paymentProvider = resolvePaymentProvider(snapshot.paymentProvider);
  assertPaymentProviderSupported(paymentProvider);
  return paymentProvider;
}

export function applyPricingToSnapshot(
  snapshot: BookingSnapshot,
  pricing: FlightPricingResponse,
): BookingSnapshot {
  const offerWithSchedule = syncOfferScheduleFromPricing(snapshot.offer, pricing);

  return {
    ...snapshot,
    pricing,
    offer: {
      ...offerWithSchedule,
      price: {
        ...offerWithSchedule.price,
        total: pricing.price.total.toFixed(2),
        grandTotal: pricing.price.total.toFixed(2),
      },
    },
  };
}

export function extractRouteFromSnapshot(snapshot: BookingSnapshot): BookingRouteInfo {
  const segments = extractAllSegmentsFromSnapshot(snapshot);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  const origin = firstSegment.departure?.iataCode;
  const destination = lastSegment.arrival?.iataCode;

  if (!origin || !destination) {
    throw new BadRequestException('Route airports not found in booking snapshot');
  }

  return { firstSegment, origin, destination };
}
