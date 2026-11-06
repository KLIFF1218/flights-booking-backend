import { BadRequestException } from '@nestjs/common';
import { type PassengerType } from '@prisma/client';
import type { AssignSeatDto } from '../../dtos/booking/add-seats.dto';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';
import { isLapInfantType } from 'src/shared/booking/passenger-counts.util';

export interface SeatSelectionTraveler {
  id: string;
  passengerType: PassengerType;
}

export function resolveSeatingTravelers(
  snapshot: BookingSnapshot,
  travelers: SeatSelectionTraveler[],
): SeatSelectionTraveler[] {
  if (travelers.length > 0) {
    return travelers.filter((traveler) => !isLapInfantType(traveler.passengerType));
  }

  return (snapshot.pricing.travelers ?? [])
    .filter((traveler) => !isLapInfantType(traveler.travelerType))
    .map((traveler, index) => ({
      id: traveler.travelerId ?? `traveler-${index + 1}`,
      passengerType: traveler.travelerType,
    }));
}

export function resolveSegmentIds(snapshot: BookingSnapshot): string[] {
  return snapshot.offer.itineraries.flatMap((itinerary) =>
    itinerary.segments.map((segment) => segment.id),
  );
}

export function assertSeatSelectionComplete(
  snapshot: BookingSnapshot,
  seats: AssignSeatDto[],
  travelers: SeatSelectionTraveler[],
): void {
  const segmentIds = resolveSegmentIds(snapshot);

  if (segmentIds.length === 0) {
    throw new BadRequestException('No flight segments found in booking snapshot');
  }

  const seatingTravelers = resolveSeatingTravelers(snapshot, travelers);

  if (seatingTravelers.length === 0) {
    throw new BadRequestException('No travelers requiring seat selection');
  }

  const seatingTravelerIds = new Set(seatingTravelers.map((traveler) => traveler.id));
  const assignmentsBySegment = new Map<string, Set<string>>();

  for (const seat of seats) {
    if (!seatingTravelerIds.has(seat.travelerId)) {
      throw new BadRequestException(`Traveler ${seat.travelerId} does not require a seat`);
    }

    if (!segmentIds.includes(seat.segmentId)) {
      throw new BadRequestException(`Invalid segment: ${seat.segmentId}`);
    }

    const travelersOnSegment = assignmentsBySegment.get(seat.segmentId) ?? new Set<string>();

    if (travelersOnSegment.has(seat.travelerId)) {
      throw new BadRequestException('Duplicate seat assignment for traveler on segment');
    }

    travelersOnSegment.add(seat.travelerId);
    assignmentsBySegment.set(seat.segmentId, travelersOnSegment);
  }

  for (const segmentId of segmentIds) {
    const assignedTravelerIds = assignmentsBySegment.get(segmentId) ?? new Set<string>();

    if (assignedTravelerIds.size !== seatingTravelers.length) {
      throw new BadRequestException(
        `Seat selection incomplete for segment ${segmentId}: expected ${seatingTravelers.length} seats, received ${assignedTravelerIds.size}`,
      );
    }

    for (const traveler of seatingTravelers) {
      if (!assignedTravelerIds.has(traveler.id)) {
        throw new BadRequestException(`Missing seat for traveler on segment ${segmentId}`);
      }
    }
  }
}

export type ExistingSeatAssignment = {
  travelerId: string;
  segmentId: string;
  seat: { seatNumber: string };
};

export function mapSeatAssignmentsToSeatDtos(
  assignments: ExistingSeatAssignment[],
): AssignSeatDto[] {
  return assignments.map((assignment) => ({
    travelerId: assignment.travelerId,
    segmentId: assignment.segmentId,
    seatNumber: assignment.seat.seatNumber,
  }));
}

export function isSeatSelectionComplete(
  snapshot: BookingSnapshot,
  seats: AssignSeatDto[],
  travelers: SeatSelectionTraveler[],
): boolean {
  try {
    assertSeatSelectionComplete(snapshot, seats, travelers);
    return true;
  } catch {
    return false;
  }
}

export function resolveCheckoutSeats(
  requestSeats: AssignSeatDto[],
  persistedAssignments: ExistingSeatAssignment[],
): AssignSeatDto[] {
  if (requestSeats.length > 0) {
    return requestSeats;
  }

  return mapSeatAssignmentsToSeatDtos(persistedAssignments);
}

export function seatAssignmentsMatchRequest(
  seats: AssignSeatDto[],
  assignments: ExistingSeatAssignment[],
): boolean {
  if (seats.length !== assignments.length) {
    return false;
  }

  const requested = new Set(
    seats.map((seat) => `${seat.travelerId}:${seat.segmentId}:${seat.seatNumber}`),
  );
  const existing = new Set(
    assignments.map(
      (assignment) =>
        `${assignment.travelerId}:${assignment.segmentId}:${assignment.seat.seatNumber}`,
    ),
  );

  return requested.size === existing.size && [...requested].every((entry) => existing.has(entry));
}
