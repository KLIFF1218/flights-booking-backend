import { BookingStatus } from '@prisma/client';
import { BookingSeatService } from '../seats/booking-seat.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type BookingsCacheService } from '../lifecycle/bookings-cache.service';
import { type BookingExpirationService } from '../lifecycle/booking-expiration.service';
import { type SeatReleaseService } from '../seats/seat-release.service';
import { createBookingMetricsMock } from '../../metrics/booking-metrics.mock';

describe('BookingSeatService', () => {
  let service: BookingSeatService;

  const prisma = {
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    seatHold: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const bookingExpirationService = {
    ensureActive: jest.fn(),
  };
  const seatReleaseService = {
    releaseSeatsForBooking: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();

  const booking = {
    id: 'booking-1',
    userId: 'user-1',
    status: BookingStatus.SEATS_SELECTED,
    expiresAt: new Date('2026-12-31T00:00:00Z'),
    travelers: [{ id: 'trav-1', passengerType: 'ADULT' }],
    seatAssignments: [
      {
        travelerId: 'trav-1',
        segmentId: 'seg-1',
        seat: { seatNumber: '12A' },
      },
    ],
    snapshot: {
      offer: {
        itineraries: [
          {
            segments: [{ id: 'seg-1', flightInstanceId: 'fi-1' }],
          },
        ],
      },
      pricing: {
        travelers: [{ travelerId: 'trav-1', travelerType: 'ADULT' }],
      },
    },
  };

  const seats = [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingSeatService(
      prisma as unknown as PrismaService,
      bookingsCache as unknown as BookingsCacheService,
      bookingExpirationService as unknown as BookingExpirationService,
      seatReleaseService as unknown as SeatReleaseService,
      bookingMetrics,
    );
    prisma.booking.findFirst.mockResolvedValue(booking);
    bookingExpirationService.ensureActive.mockResolvedValue(undefined);
    prisma.seatHold.updateMany.mockResolvedValue({ count: 1 });
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);
  });

  it('rejects seat assignment when travelers are not persisted yet', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      travelers: [],
      seatAssignments: [],
      status: BookingStatus.PNR_CREATED,
    });

    await expect(service.assignSeats('booking-1', 'user-1', seats)).rejects.toThrow(
      'Travelers must be added before seat assignment',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns unchanged when the same seats are assigned again', async () => {
    const result = await service.assignSeats('booking-1', 'user-1', seats);

    expect(result).toEqual({ success: true, unchanged: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.seatHold.updateMany).toHaveBeenCalled();
    expect(seatReleaseService.releaseSeatsForBooking).not.toHaveBeenCalled();
  });

  it('reassigns seats when selection changes', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      seatAssignment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'assignment-1' }]),
        createMany: jest.fn(),
      },
      seatHold: { createMany: jest.fn() },
      flightSeat: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'seat-2', flightInstanceId: 'fi-1', seatNumber: '14C' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.assignSeats('booking-1', 'user-1', [
      { travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '14C' },
    ]);

    expect(result).toEqual({ success: true, unchanged: false });
    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith(
      'booking-1',
      tx,
      'reassign',
    );
    expect(tx.flightSeat.updateMany).toHaveBeenCalledWith({
      where: { id: 'seat-2', status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });
    expect(tx.seatAssignment.createMany).toHaveBeenCalled();
  });
});
