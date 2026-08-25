import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertBookingHasStatus, updateBookingIfStatus } from './booking-state.util';

describe('booking-state.util', () => {
  const client = {
    booking: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when booking status is not allowed', async () => {
    client.booking.findFirst.mockResolvedValue(null);

    await expect(
      assertBookingHasStatus(client, 'booking-1', [BookingStatus.PNR_CREATED], 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates booking only when status matches', async () => {
    client.booking.updateMany.mockResolvedValue({ count: 1 });

    await updateBookingIfStatus(
      client,
      'booking-1',
      [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED],
      { status: BookingStatus.SEATS_SELECTED },
      'user-1',
    );

    expect(client.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        userId: 'user-1',
        status: { in: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED] },
      },
      data: { status: BookingStatus.SEATS_SELECTED },
    });
  });

  it('throws when guarded update affects zero rows', async () => {
    client.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateBookingIfStatus(client, 'booking-1', [BookingStatus.PNR_CREATED], {
        status: BookingStatus.CANCELED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
