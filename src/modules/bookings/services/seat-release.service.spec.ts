import { Test, type TestingModule } from '@nestjs/testing';
import { SeatReleaseService } from './seat-release.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { createBookingMetricsMock } from '../metrics/booking-metrics.mock';
import { BookingMetricsService } from '../metrics/booking-metrics.service';

describe('SeatReleaseService', () => {
  let service: SeatReleaseService;
  let module: TestingModule;

  const mockPrisma = {
    seatHold: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const metrics = {
    recordSeatHoldDuration: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        SeatReleaseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingMetricsService, useValue: createBookingMetricsMock() },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get<SeatReleaseService>(SeatReleaseService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('should return 0 when there are no expired holds', async () => {
    mockPrisma.seatHold.findMany.mockResolvedValue([]);

    await expect(service.releaseExpiredHolds()).resolves.toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should skip expired bookings so BookingExpirationService can handle them', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const expiredHold = {
      id: 'hold_1',
      bookingId: 'booking_1',
      flightSeatId: 'seat_1',
      travelerId: 'traveler_1',
      segmentId: 'segment_1',
    };

    mockPrisma.seatHold.findMany.mockResolvedValue([expiredHold]);

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking_1',
          status: BookingStatus.SEATS_SELECTED,
          expiresAt: new Date('2026-01-01T11:00:00Z'),
          transaction: null,
        }),
        update: jest.fn(),
      },
      seatHold: {
        updateMany: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(service.releaseExpiredHolds(now)).resolves.toBe(0);

    expect(tx.seatHold.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('should resync hold TTL while booking is still active', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const bookingExpiresAt = new Date('2026-01-01T13:00:00Z');
    const expiredHold = {
      id: 'hold_1',
      bookingId: 'booking_1',
      flightSeatId: 'seat_1',
      travelerId: 'traveler_1',
      segmentId: 'segment_1',
    };

    mockPrisma.seatHold.findMany.mockResolvedValue([expiredHold]);

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking_1',
          status: BookingStatus.SEATS_SELECTED,
          expiresAt: bookingExpiresAt,
          transaction: null,
        }),
        update: jest.fn(),
      },
      seatHold: {
        updateMany: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(service.releaseExpiredHolds(now)).resolves.toBe(0);

    expect(tx.seatHold.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['hold_1'] }, expiresAt: { lt: now } },
      data: { expiresAt: bookingExpiresAt },
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('should skip release while payment is pending', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const expiredHold = {
      id: 'hold_1',
      bookingId: 'booking_1',
      flightSeatId: 'seat_1',
      travelerId: 'traveler_1',
      segmentId: 'segment_1',
    };

    mockPrisma.seatHold.findMany.mockResolvedValue([expiredHold]);

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking_1',
          status: BookingStatus.PAYMENT_PENDING,
          transaction: { status: TransactionStatus.PENDING },
        }),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(service.releaseExpiredHolds(now)).resolves.toBe(0);
    expect(tx.booking.findUnique).toHaveBeenCalled();
  });

  it('should release seats for booking inside transaction', async () => {
    const tx = {
      seatHold: { deleteMany: jest.fn() },
      seatAssignment: {
        findMany: jest.fn().mockResolvedValue([{ flightSeatId: 'seat_1' }]),
        deleteMany: jest.fn(),
      },
      flightSeat: { updateMany: jest.fn() },
    };

    await service.releaseSeatsForBooking('booking_1', tx as any);

    expect(tx.seatHold.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'booking_1' } });
    expect(tx.flightSeat.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['seat_1'] }, status: 'RESERVED' },
      data: { status: 'AVAILABLE' },
    });
    expect(tx.seatAssignment.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking_1' },
    });
  });
});
