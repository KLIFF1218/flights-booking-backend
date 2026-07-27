import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

const ADMIN_ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, readonly BookingStatus[]>> = {
  [BookingStatus.PAID]: [BookingStatus.TICKETING],
  [BookingStatus.TICKETING]: [BookingStatus.TICKETED, BookingStatus.PAID],
  [BookingStatus.TICKETED]: [BookingStatus.TICKETED],
};

export function assertAdminBookingStatusTransition(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  const allowedTargets = ADMIN_ALLOWED_TRANSITIONS[currentStatus];

  if (!allowedTargets?.includes(nextStatus)) {
    throw new BadRequestException(
      `Manual status transition from ${currentStatus} to ${nextStatus} is not allowed`,
    );
  }
}
