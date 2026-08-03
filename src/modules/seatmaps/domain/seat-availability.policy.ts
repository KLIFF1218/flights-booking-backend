import { SeatStatus } from '@prisma/client';

export function isSeatAvailableForSegment(
  seat: {
    status: SeatStatus;
    seatHolds: Array<{ segmentId: string }>;
    seatAssignments: Array<{ segmentId: string }>;
  },
  segmentId: string,
): boolean {
  const hasActiveHold = seat.seatHolds.some((hold) => hold.segmentId === segmentId);
  const isAssigned = seat.seatAssignments.some((assignment) => assignment.segmentId === segmentId);

  return seat.status === SeatStatus.AVAILABLE && !hasActiveHold && !isAssigned;
}
