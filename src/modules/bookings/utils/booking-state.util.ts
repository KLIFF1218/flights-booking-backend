import { BadRequestException } from '@nestjs/common';
import { type BookingStatus, type Prisma } from '@prisma/client';

type BookingDbClient = Pick<Prisma.TransactionClient, 'booking'>;

export async function assertBookingHasStatus(
  client: BookingDbClient,
  bookingId: string,
  allowedStatuses: readonly BookingStatus[],
  userId?: string,
): Promise<void> {
  const booking = await client.booking.findFirst({
    where: {
      id: bookingId,
      ...(userId ? { userId } : {}),
      status: { in: [...allowedStatuses] },
    },
    select: { id: true },
  });

  if (!booking) {
    throw new BadRequestException('Operation not allowed for current booking status');
  }
}

export async function updateBookingIfStatus(
  client: BookingDbClient,
  bookingId: string,
  allowedStatuses: readonly BookingStatus[],
  data: Prisma.BookingUpdateManyMutationInput,
  userId?: string,
): Promise<void> {
  const updated = await tryUpdateBookingIfStatus(client, bookingId, allowedStatuses, data, userId);

  if (!updated) {
    throw new BadRequestException('Operation not allowed for current booking status');
  }
}

export async function tryUpdateBookingIfStatus(
  client: BookingDbClient,
  bookingId: string,
  allowedStatuses: readonly BookingStatus[],
  data: Prisma.BookingUpdateManyMutationInput,
  userId?: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      ...(userId ? { userId } : {}),
      status: { in: [...allowedStatuses] },
    },
    data,
  });

  return result.count === 1;
}
