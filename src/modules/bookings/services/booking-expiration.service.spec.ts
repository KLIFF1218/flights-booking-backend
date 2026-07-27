import { BookingStatus } from '@prisma/client';
import { BookingExpirationService } from './booking-expiration.service';
import { EXPIRATION_BATCH_SIZE } from '../constants/booking-expiration.constants';
import { type SeatReleaseService } from './seat-release.service';
import { type BookingsCacheService } from './bookings-cache.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type Logger } from 'nestjs-pino';
import { createBookingMetricsMock } from '../metrics/booking-metrics.mock';
import { type OutboxService } from 'src/infra/outbox/outbox.service';

describe('BookingExpirationService', () => {
  let service: BookingExpirationService;

  const prisma = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const seatReleaseService = {
    releaseSeatsForBooking: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();
  const outbox = {
    enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingExpirationService(
      prisma as unknown as PrismaService,
      seatReleaseService as unknown as SeatReleaseService,
      bookingsCache as unknown as BookingsCacheService,
      logger as unknown as Logger,
      bookingMetrics,
      outbox as unknown as OutboxService,
    );
  });

  it('does not expire PAYMENT_PENDING bookings by booking TTL', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    prisma.booking.findMany.mockResolvedValue([]);

    await expect(service.expireStaleBookings(now)).resolves.toBe(0);

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED] },
        expiresAt: { lt: now },
      },
      select: { id: true, userId: true },
      take: EXPIRATION_BATCH_SIZE,
    });
  });

  it('processes stale bookings in multiple batches until backlog is cleared', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const fullBatch = Array.from({ length: EXPIRATION_BATCH_SIZE }, (_, index) => ({
      id: `booking-${index}`,
      userId: 'user-1',
    }));

    prisma.booking.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: 'booking-last', userId: 'user-1' }]);

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'booking-1',
            userId: 'user-1',
            status: BookingStatus.SEATS_SELECTED,
            expiresAt: new Date('2026-01-01T11:00:00Z'),
            transaction: null,
            snapshot: {
              offer: {
                itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
              },
              pricing: { travelers: [] },
            },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn(),
        },
        transaction: {
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        traveler: {
          count: jest.fn().mockResolvedValue(0),
        },
        flightInstance: {
          findUnique: jest.fn().mockResolvedValue({
            seatsAvailable: 10,
            _count: { seats: 10 },
          }),
          update: jest.fn(),
        },
      }),
    );

    await expect(service.expireStaleBookings(now)).resolves.toBe(EXPIRATION_BATCH_SIZE + 1);

    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
  });

  it('expires stale bookings and releases seats', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1', userId: 'user-1' }]);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'booking-1',
            userId: 'user-1',
            status: BookingStatus.SEATS_SELECTED,
            expiresAt: new Date('2026-01-01T11:00:00Z'),
            transaction: null,
            snapshot: {
              offer: {
                itineraries: [{ segments: [{ flightInstanceId: 'fi-1' }] }],
              },
              pricing: { travelers: [] },
            },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn(),
        },
        transaction: {
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        traveler: {
          count: jest.fn().mockResolvedValue(0),
        },
        flightInstance: {
          findUnique: jest.fn().mockResolvedValue({
            seatsAvailable: 10,
            _count: { seats: 10 },
          }),
          update: jest.fn(),
        },
      }),
    );

    await expect(service.expireStaleBookings(now)).resolves.toBe(1);

    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Object),
      'expire',
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        topic: 'booking.expired',
        transport: 'KAFKA',
      }),
    );
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('rejects operations on expired bookings', async () => {
    await expect(
      service.ensureActive({
        id: 'booking-1',
        userId: 'user-1',
        status: BookingStatus.EXPIRED,
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      }),
    ).rejects.toThrow('Booking has expired');
  });
});
