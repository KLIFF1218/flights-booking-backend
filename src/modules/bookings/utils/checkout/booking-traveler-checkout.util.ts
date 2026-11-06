import { BadRequestException } from '@nestjs/common';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';

export function assertTravelersReadyForCheckout(
  snapshot: BookingSnapshot,
  persistedTravelers: { id: string }[],
): void {
  const expectedTravelerCount = snapshot.pricing?.travelers?.length ?? 0;

  if (expectedTravelerCount === 0) {
    throw new BadRequestException('Traveler pricing is missing from booking snapshot');
  }

  if (persistedTravelers.length === 0) {
    throw new BadRequestException('Travelers must be added before checkout');
  }

  if (persistedTravelers.length !== expectedTravelerCount) {
    throw new BadRequestException(
      `Expected ${expectedTravelerCount} travelers, found ${persistedTravelers.length}`,
    );
  }
}
