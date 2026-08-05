import { BadRequestException } from '@nestjs/common';
import { type Prisma, PassengerType } from '@prisma/client';
import { extractFlightInstanceIds } from 'src/modules/flights/utils/offer/offer-flight-instances.util';
import type { BookingSnapshot } from '../interfaces/booking-snapshot.interface';

function isLapInfantTraveler(traveler: { travelerType?: string; passengerType?: string }): boolean {
  return (
    traveler.travelerType === PassengerType.HELD_INFANT ||
    traveler.passengerType === PassengerType.HELD_INFANT ||
    traveler.travelerType === 'HELD_INFANT' ||
    traveler.passengerType === 'HELD_INFANT'
  );
}

/** Seat-taking passengers only — lap infants (HELD_INFANT) do not consume inventory. */
export function resolveSeatsToReserve(
  snapshot: BookingSnapshot,
  persistedSeatTakingTravelerCount = 0,
): number {
  if (persistedSeatTakingTravelerCount > 0) {
    return persistedSeatTakingTravelerCount;
  }

  const travelers = snapshot.pricing?.travelers ?? [];
  return travelers.filter((traveler) => !isLapInfantTraveler(traveler)).length;
}

export async function reserveFlightInstanceInventory(
  tx: Prisma.TransactionClient,
  flightInstanceIds: string[],
  seatsToReserve: number,
): Promise<void> {
  if (seatsToReserve <= 0 || flightInstanceIds.length === 0) {
    return;
  }

  for (const flightInstanceId of flightInstanceIds) {
    const updated = await tx.flightInstance.updateMany({
      where: {
        id: flightInstanceId,
        seatsAvailable: { gte: seatsToReserve },
      },
      data: {
        seatsAvailable: { decrement: seatsToReserve },
      },
    });

    if (updated.count !== 1) {
      throw new BadRequestException('Not enough seats available');
    }
  }
}

export async function releaseFlightInstanceInventory(
  tx: Prisma.TransactionClient,
  flightInstanceIds: string[],
  seatsToRelease: number,
): Promise<void> {
  if (seatsToRelease <= 0 || flightInstanceIds.length === 0) {
    return;
  }

  for (const flightInstanceId of flightInstanceIds) {
    const instance = await tx.flightInstance.findUnique({
      where: { id: flightInstanceId },
      select: {
        seatsAvailable: true,
        _count: { select: { seats: true } },
      },
    });

    if (!instance) {
      continue;
    }

    const uncapped = instance.seatsAvailable + seatsToRelease;
    const seatMapCapacity = instance._count.seats;
    const nextAvailable = seatMapCapacity > 0 ? Math.min(uncapped, seatMapCapacity) : uncapped;

    await tx.flightInstance.update({
      where: { id: flightInstanceId },
      data: { seatsAvailable: nextAvailable },
    });
  }
}

export async function releaseFlightInstanceInventoryForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
  snapshot: BookingSnapshot,
): Promise<void> {
  const flightInstanceIds = extractFlightInstanceIds(snapshot.offer);
  const seatTakingTravelerCount = await tx.traveler.count({
    where: {
      bookingId,
      passengerType: { not: PassengerType.HELD_INFANT },
    },
  });
  const seatsToRelease = resolveSeatsToReserve(snapshot, seatTakingTravelerCount);

  await releaseFlightInstanceInventory(tx, flightInstanceIds, seatsToRelease);
}

export async function decrementFlightInstanceInventory(
  tx: Prisma.TransactionClient,
  bookingId: string,
  snapshot: BookingSnapshot,
): Promise<void> {
  const flightInstanceIds = extractFlightInstanceIds(snapshot.offer);
  const seatTakingTravelerCount = await tx.traveler.count({
    where: {
      bookingId,
      passengerType: { not: PassengerType.HELD_INFANT },
    },
  });
  const seatsToDecrement = resolveSeatsToReserve(snapshot, seatTakingTravelerCount);

  await reserveFlightInstanceInventory(tx, flightInstanceIds, seatsToDecrement);
}
