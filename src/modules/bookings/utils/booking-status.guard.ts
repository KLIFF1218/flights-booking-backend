import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

export enum BookingOperation {
  ADD_TRAVELERS = 'ADD_TRAVELERS',
  ASSIGN_SEATS = 'ASSIGN_SEATS',
  CHECKOUT = 'CHECKOUT',
}

const ALLOWED_STATUSES: Record<BookingOperation, readonly BookingStatus[]> = {
  [BookingOperation.ADD_TRAVELERS]: [BookingStatus.PNR_CREATED],
  [BookingOperation.ASSIGN_SEATS]: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED],
  [BookingOperation.CHECKOUT]: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED],
};

export function getAllowedStatusesForOperation(
  operation: BookingOperation,
): readonly BookingStatus[] {
  return ALLOWED_STATUSES[operation];
}

export function assertBookingStatusAllows(
  status: BookingStatus,
  operation: BookingOperation,
): void {
  const allowedStatuses = ALLOWED_STATUSES[operation];

  if (!allowedStatuses.includes(status)) {
    throw new BadRequestException(
      `Operation ${operation} is not allowed for booking status ${status}`,
    );
  }
}
