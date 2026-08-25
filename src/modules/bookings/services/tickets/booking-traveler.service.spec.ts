import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingTravelerService } from '../tickets/booking-traveler.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type BookingsCacheService } from '../lifecycle/bookings-cache.service';
import { type Logger } from 'nestjs-pino';
import { type BookingExpirationService } from '../lifecycle/booking-expiration.service';
import { createBookingMetricsMock } from '../../metrics/booking-metrics.mock';

describe('BookingTravelerService', () => {
  let service: BookingTravelerService;

  const prisma = {
    booking: { findFirst: jest.fn() },
    seatAssignment: { count: jest.fn() },
    seatHold: { count: jest.fn() },
    traveler: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const bookingsCache = { invalidateBooking: jest.fn() };
  const logger = { debug: jest.fn() };
  const bookingExpirationService = {
    ensureActive: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();

  const booking = {
    id: 'booking-1',
    userId: 'user-1',
    status: BookingStatus.PNR_CREATED,
    expiresAt: new Date('2026-12-31T00:00:00Z'),
    currency: 'RUB',
    snapshot: {
      pricing: { travelers: [] },
      offer: { itineraries: [{ segments: [{ departure: { at: '2026-08-01T10:00:00' } }] }] },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingTravelerService(
      prisma as unknown as PrismaService,
      bookingsCache as unknown as BookingsCacheService,
      logger as unknown as Logger,
      bookingExpirationService as unknown as BookingExpirationService,
      bookingMetrics,
    );
    prisma.booking.findFirst.mockResolvedValue(booking);
    bookingExpirationService.ensureActive.mockResolvedValue(undefined);
    prisma.seatAssignment.count.mockResolvedValue(0);
    prisma.seatHold.count.mockResolvedValue(0);
    prisma.traveler.findMany.mockResolvedValue([]);
  });

  it('rejects addTravelers when seats are already assigned', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          findFirst: jest.fn().mockResolvedValue(booking),
          findUniqueOrThrow: jest.fn(),
        },
        seatAssignment: { count: jest.fn().mockResolvedValue(2) },
        seatHold: { count: jest.fn().mockResolvedValue(0) },
        traveler: { deleteMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
      }),
    );

    await expect(service.addTravelers('booking-1', 'user-1', [])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects addTravelers when seat holds exist', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          findFirst: jest.fn().mockResolvedValue(booking),
          findUniqueOrThrow: jest.fn(),
        },
        seatAssignment: { count: jest.fn().mockResolvedValue(0) },
        seatHold: { count: jest.fn().mockResolvedValue(1) },
        traveler: { deleteMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
      }),
    );

    await expect(service.addTravelers('booking-1', 'user-1', [])).rejects.toThrow(
      BadRequestException,
    );
  });
});
