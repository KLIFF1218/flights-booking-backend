import { ConflictException, NotFoundException } from '@nestjs/common';
import { FlightStatus } from '@prisma/client';
import { assertBookingFlightsStillBookable } from './booking-flight-validation.util';

describe('assertBookingFlightsStillBookable', () => {
  const prisma = {
    flightInstance: {
      findMany: jest.fn(),
    },
  };

  const snapshot = {
    offer: {
      itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when a flight instance is missing', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([]);

    await expect(
      assertBookingFlightsStillBookable(prisma as any, snapshot),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when flight is cancelled', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      { id: 'fi-1', status: FlightStatus.CANCELLED },
    ]);

    await expect(
      assertBookingFlightsStillBookable(prisma as any, snapshot),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('passes for scheduled instances', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      { id: 'fi-1', status: FlightStatus.SCHEDULED },
    ]);

    await expect(
      assertBookingFlightsStillBookable(prisma as any, snapshot),
    ).resolves.toBeUndefined();
  });
});
