import { BadRequestException } from '@nestjs/common';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';

type BookingSeatRefsClient = Pick<PrismaService, 'seatAssignment' | 'seatHold'>;

export async function assertNoSeatsAssignedToBooking(
  prisma: BookingSeatRefsClient,
  bookingId: string,
): Promise<void> {
  const [assignmentsCount, holdsCount] = await Promise.all([
    prisma.seatAssignment.count({ where: { bookingId } }),
    prisma.seatHold.count({ where: { bookingId } }),
  ]);

  if (assignmentsCount > 0 || holdsCount > 0) {
    throw new BadRequestException(
      'Cannot modify travelers while seats are assigned. Release seats first.',
    );
  }
}
