import { BadRequestException } from '@nestjs/common';
import { assertNoSeatsAssignedToBooking } from './booking-traveler.util';

describe('assertNoSeatsAssignedToBooking', () => {
  const prisma = {
    seatAssignment: { count: jest.fn() },
    seatHold: { count: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.seatAssignment.count.mockResolvedValue(0);
    prisma.seatHold.count.mockResolvedValue(0);
  });

  it('passes when booking has no seat assignments or holds', async () => {
    await expect(assertNoSeatsAssignedToBooking(prisma, 'booking-1')).resolves.toBeUndefined();
  });

  it('rejects when booking has seat assignments', async () => {
    prisma.seatAssignment.count.mockResolvedValue(1);

    await expect(assertNoSeatsAssignedToBooking(prisma, 'booking-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when booking has seat holds', async () => {
    prisma.seatHold.count.mockResolvedValue(1);

    await expect(assertNoSeatsAssignedToBooking(prisma, 'booking-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
