import { BookingStatus, type Prisma } from '@prisma/client';

type BookingDbClient = Pick<Prisma.TransactionClient, 'booking'>;

export async function markBookingPaidIfPending(
  client: BookingDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.PAID,
    },
  });

  return result.count === 1;
}

export async function markBookingCanceledIfPaymentPending(
  client: BookingDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.CANCELED,
    },
  });

  return result.count === 1;
}

export async function markBookingExpiredIfPaymentPending(
  client: BookingDbClient,
  bookingId: string,
): Promise<boolean> {
  const result = await client.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PAYMENT_PENDING,
    },
    data: {
      status: BookingStatus.EXPIRED,
    },
  });

  return result.count === 1;
}
