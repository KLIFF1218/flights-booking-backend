import { ConflictException } from '@nestjs/common';
import type { FlightPricingResponse } from '../../dtos/flight-pricing.response.dto';
import { FlightStatus } from '@prisma/client';
import type { FlightOffer } from '../../interfaces/flight-offers.interface';
import type { FlightInstanceWithRelations } from '../../providers/prisma/flight-instance.type';
import { mapSegments } from '../../services/mappers/flight-segment.mapper';
import { calculateDoorToDoorDurationMinutes } from '../datetime/duration.util';
import { formatDuration } from '../datetime/time.util';

function resolveSegmentTimesFromInstance(
  instance: FlightInstanceWithRelations,
  segmentId: string,
): { departureAt: string; arrivalAt: string; duration: string } | null {
  const templateSegments = instance.flight.segments;
  const templateSegment =
    templateSegments.find((segment) => segment.id === segmentId) ?? templateSegments[0];

  if (!templateSegment) {
    return null;
  }

  if (templateSegments.length === 1) {
    const departureAt = new Date(instance.departureDate);
    const arrivalAt = new Date(departureAt.getTime() + templateSegment.durationMinutes * 60_000);

    return {
      departureAt: departureAt.toISOString(),
      arrivalAt: arrivalAt.toISOString(),
      duration: formatDuration(templateSegment.durationMinutes),
    };
  }

  const freshSegments = mapSegments(instance);
  const fresh =
    freshSegments.find((segment) => segment.id === segmentId) ??
    freshSegments.find((segment) => segment.flightInstanceId === instance.id);

  if (!fresh) {
    return null;
  }

  return {
    departureAt: fresh.departure.at,
    arrivalAt: fresh.arrival.at,
    duration: fresh.duration,
  };
}

export type ScheduleChange = {
  flightInstanceId: string;
  segmentId: string;
  previousDepartureTime: string;
  currentDepartureTime: string;
  previousArrivalTime: string;
  currentArrivalTime: string;
  delayMinutes: number;
};

export type OperationalScheduleSnapshot = {
  offer: FlightOffer;
  scheduleChanged: boolean;
  operationalStatus: FlightStatus | 'MIXED';
  delayMinutes: number;
  scheduleChanges: ScheduleChange[];
};

export function offerReferencesFlightInstance(
  offer: FlightOffer,
  flightInstanceId: string,
): boolean {
  return offer.itineraries.some((itinerary) =>
    itinerary.segments.some((segment) => segment.flightInstanceId === flightInstanceId),
  );
}

export function assertFlightInstancesBookable(
  instances: Array<{ id: string; status: FlightStatus }>,
): void {
  for (const instance of instances) {
    if (instance.status === FlightStatus.CANCELLED) {
      throw new ConflictException(
        'Flight has been cancelled and is no longer available for booking',
      );
    }

    if (instance.status === FlightStatus.COMPLETED) {
      throw new ConflictException(
        'Flight has already departed and is no longer available for booking',
      );
    }
  }
}

export function patchOfferSegmentFromInstance(
  offer: FlightOffer,
  instance: FlightInstanceWithRelations,
): { offer: FlightOffer; scheduleChanged: boolean; scheduleChanges: ScheduleChange[] } {
  const updated = structuredClone(offer);
  const scheduleChanges: ScheduleChange[] = [];
  let scheduleChanged = false;

  for (const itinerary of updated.itineraries) {
    for (const segment of itinerary.segments) {
      if (segment.flightInstanceId !== instance.id) {
        continue;
      }

      const fresh = resolveSegmentTimesFromInstance(instance, segment.id);

      if (!fresh) {
        continue;
      }

      const departureChanged = segment.departure.at !== fresh.departureAt;
      const arrivalChanged = segment.arrival.at !== fresh.arrivalAt;

      if (!departureChanged && !arrivalChanged) {
        continue;
      }

      scheduleChanges.push({
        flightInstanceId: instance.id,
        segmentId: segment.id,
        previousDepartureTime: segment.departure.at,
        currentDepartureTime: fresh.departureAt,
        previousArrivalTime: segment.arrival.at,
        currentArrivalTime: fresh.arrivalAt,
        delayMinutes: instance.delayMinutes ?? 0,
      });

      segment.departure.at = fresh.departureAt;
      segment.arrival.at = fresh.arrivalAt;
      segment.duration = fresh.duration;
      scheduleChanged = true;
    }

    if (itinerary.segments.length > 0) {
      const first = itinerary.segments[0];
      const last = itinerary.segments[itinerary.segments.length - 1];
      itinerary.duration = formatDuration(
        calculateDoorToDoorDurationMinutes(first.departure.at, last.arrival.at),
      );
    }
  }

  return { offer: updated, scheduleChanged, scheduleChanges };
}

export function syncOfferScheduleFromPricing(
  offer: FlightOffer,
  pricing: Pick<FlightPricingResponse, 'scheduleChanged' | 'outbound' | 'inbound'>,
): FlightOffer {
  if (!pricing.scheduleChanged) {
    return offer;
  }

  const updated = structuredClone(offer);
  const pricingSegments = [
    ...(pricing.outbound?.segments ?? []),
    ...(pricing.inbound?.segments ?? []),
  ];
  const pricingBySegmentId = new Map(
    pricingSegments.map((segment) => [segment.segmentId, segment]),
  );

  for (const itinerary of updated.itineraries) {
    for (const segment of itinerary.segments) {
      const fresh = pricingBySegmentId.get(segment.id);
      if (!fresh) {
        continue;
      }

      segment.departure.at = fresh.departureTime;
      segment.arrival.at = fresh.arrivalTime;
    }

    if (itinerary.segments.length > 0) {
      const first = itinerary.segments[0];
      const last = itinerary.segments[itinerary.segments.length - 1];
      itinerary.duration = formatDuration(
        calculateDoorToDoorDurationMinutes(first.departure.at, last.arrival.at),
      );
    }
  }

  return updated;
}

export function applyInstanceSchedulesToOffer(
  offer: FlightOffer,
  instancesMap: Map<string, FlightInstanceWithRelations>,
): OperationalScheduleSnapshot {
  let updated = structuredClone(offer);
  const scheduleChanges: ScheduleChange[] = [];
  let scheduleChanged = false;
  const statuses = new Set<FlightStatus>();

  for (const instance of instancesMap.values()) {
    statuses.add(instance.status);
    const patched = patchOfferSegmentFromInstance(updated, instance);
    updated = patched.offer;
    scheduleChanges.push(...patched.scheduleChanges);
    scheduleChanged ||= patched.scheduleChanged;
  }

  const delayMinutes = Math.max(
    0,
    ...[...instancesMap.values()].map((instance) => instance.delayMinutes ?? 0),
  );

  const operationalStatus = statuses.size === 1 ? [...statuses][0] : ('MIXED' as const);

  return {
    offer: updated,
    scheduleChanged,
    operationalStatus,
    delayMinutes,
    scheduleChanges,
  };
}
