import { BadRequestException } from '@nestjs/common';
import type { FlightOffer, FlightOfferLeg } from '../../interfaces/flight-offers.interface';

export function extractFlightInstanceIds(offer: FlightOffer): string[] {
  const fromLegs = offer.legs?.map((leg) => leg.flightInstanceId).filter(Boolean) ?? [];

  if (fromLegs.length > 0) {
    return [...new Set(fromLegs)];
  }

  const fromSegments = offer.itineraries.flatMap((itinerary) =>
    itinerary.segments.map((segment) => segment.flightInstanceId).filter(Boolean),
  );

  if (fromSegments.length > 0) {
    return [...new Set(fromSegments)];
  }

  if (!offer.id.includes('_')) {
    return [offer.id];
  }

  throw new BadRequestException('Offer flight instances cannot be resolved');
}

export function resolvePrimaryFlightInstanceId(offer: FlightOffer): string {
  const outboundLeg = offer.legs?.find((leg) => leg.direction === 'OUTBOUND');

  if (outboundLeg?.flightInstanceId) {
    return outboundLeg.flightInstanceId;
  }

  const ids = extractFlightInstanceIds(offer);
  return ids[0];
}

export function buildOneWayLeg(flightInstanceId: string): FlightOfferLeg {
  return {
    flightInstanceId,
    direction: 'OUTBOUND',
  };
}

export function buildRoundTripLegs(
  outboundInstanceId: string,
  inboundInstanceId: string,
): FlightOfferLeg[] {
  return [
    { flightInstanceId: outboundInstanceId, direction: 'OUTBOUND' },
    { flightInstanceId: inboundInstanceId, direction: 'INBOUND' },
  ];
}

function extractOneWayLegInstanceIds(offer: FlightOffer): string[] {
  const fromLegs = offer.legs?.map((leg) => leg.flightInstanceId).filter(Boolean) ?? [];

  if (fromLegs.length > 0) {
    return [...new Set(fromLegs)];
  }

  const fromSegments = offer.itineraries.flatMap((itinerary) =>
    itinerary.segments.map((segment) => segment.flightInstanceId).filter(Boolean),
  );

  if (fromSegments.length > 0) {
    return [...new Set(fromSegments)];
  }

  if (!offer.id.includes('_')) {
    return [offer.id];
  }

  return offer.id.split('_').filter(Boolean);
}

/** Merges legs from two one-way offers into a round-trip leg list. */
export function mergeRoundTripLegs(outbound: FlightOffer, inbound: FlightOffer): FlightOfferLeg[] {
  const outboundIds = extractOneWayLegInstanceIds(outbound);
  const inboundIds = extractOneWayLegInstanceIds(inbound);

  return [
    ...outboundIds.map((flightInstanceId) => ({
      flightInstanceId,
      direction: 'OUTBOUND' as const,
    })),
    ...inboundIds.map((flightInstanceId) => ({
      flightInstanceId,
      direction: 'INBOUND' as const,
    })),
  ];
}

export function buildConnectionLegs(
  firstInstanceId: string,
  secondInstanceId: string,
): FlightOfferLeg[] {
  return [
    { flightInstanceId: firstInstanceId, direction: 'OUTBOUND' },
    { flightInstanceId: secondInstanceId, direction: 'OUTBOUND' },
  ];
}
