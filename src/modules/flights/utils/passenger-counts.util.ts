import { BadRequestException } from '@nestjs/common';

export const MAX_PASSENGERS_PER_BOOKING = 9;

export interface PassengerCountsInput {
  adults?: number;
  children?: number;
  infants?: number;
  seatedInfants?: number;
}

export function normalizePassengerCounts(passengers: PassengerCountsInput) {
  return {
    adults: passengers.adults ?? 0,
    children: passengers.children ?? 0,
    infants: passengers.infants ?? 0,
    seatedInfants: passengers.seatedInfants ?? 0,
  };
}

export function countAllPassengers(passengers: PassengerCountsInput): number {
  const { adults, children, infants, seatedInfants } = normalizePassengerCounts(passengers);
  return adults + children + infants + seatedInfants;
}

export function validatePassengerCounts(passengers: PassengerCountsInput) {
  const { adults, children, infants, seatedInfants } = normalizePassengerCounts(passengers);
  const total = adults + children + infants + seatedInfants;
  const totalInfants = infants + seatedInfants;

  if (adults < 1) {
    throw new BadRequestException('At least one adult is required');
  }

  if (totalInfants > adults) {
    throw new BadRequestException('Infants cannot exceed adults');
  }

  if (total > MAX_PASSENGERS_PER_BOOKING) {
    throw new BadRequestException(`Maximum ${MAX_PASSENGERS_PER_BOOKING} passengers per booking`);
  }

  return { adults, children, infants, seatedInfants };
}

export function countSeatsRequired(passengers: PassengerCountsInput): number {
  const { adults, children, seatedInfants } = normalizePassengerCounts(passengers);
  return adults + children + seatedInfants;
}

export function passengerCountsMatch(
  requested: PassengerCountsInput,
  original: PassengerCountsInput,
): boolean {
  const req = normalizePassengerCounts(requested);
  const orig = normalizePassengerCounts(original);

  return (
    req.adults === orig.adults &&
    req.children === orig.children &&
    req.infants === orig.infants &&
    req.seatedInfants === orig.seatedInfants
  );
}

export function assertPassengerCountsMatchSearch(
  requested: PassengerCountsInput,
  search: PassengerCountsInput,
): void {
  if (!passengerCountsMatch(requested, search)) {
    throw new BadRequestException(
      'Passenger counts must match the original search. Start a new search to change passengers.',
    );
  }
}

export function isLapInfantType(passengerType: string): boolean {
  return passengerType === 'HELD_INFANT';
}

export function isInfantType(passengerType: string): boolean {
  return passengerType === 'HELD_INFANT' || passengerType === 'SEATED_INFANT';
}
