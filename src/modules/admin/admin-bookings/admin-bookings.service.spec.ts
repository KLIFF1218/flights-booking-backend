import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AdminBookingsService } from './admin-bookings.service';

describe('AdminBookingsService', () => {
  const prisma = {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const metrics = { recordAdminAction: jest.fn() };
  const domainEvents = { findByBookingId: jest.fn() };

  const service = new AdminBookingsService(
    prisma as never,
    metrics as never,
    domainEvents as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findAll applies status filter and pagination metadata', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);

    const result = await service.findAll({
      page: 2,
      limit: 10,
      status: BookingStatus.PAID,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: BookingStatus.PAID },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });
  });

  it('findAll applies search OR clause', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20, search: 'PNR123' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { id: { contains: 'PNR123', mode: 'insensitive' } },
            { pnrLocator: { contains: 'PNR123', mode: 'insensitive' } },
          ]),
        },
      }),
    );
  });

  it('findEvents returns mapped domain events', async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1' });
    domainEvents.findByBookingId.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'b1',
        payload: { bookingId: 'b1' },
        occurredAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);

    const result = await service.findEvents('b1');

    expect(result.data).toEqual([
      {
        id: 'evt-1',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'b1',
        payload: { bookingId: 'b1' },
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('findEvents throws NotFoundException when booking is missing', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(service.findEvents('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatus validates transition and updates booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.PAID,
    });
    prisma.booking.update.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.TICKETING,
    });

    const result = await service.updateStatus('b1', BookingStatus.TICKETING);

    expect(result.status).toBe(BookingStatus.TICKETING);
    expect(metrics.recordAdminAction).toHaveBeenCalledWith('booking_status_update', 'success');
  });

  it('updateStatus rejects illegal transitions', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.CANCELED,
    });

    await expect(service.updateStatus('b1', BookingStatus.PAID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(metrics.recordAdminAction).toHaveBeenCalledWith('booking_status_update', 'failure');
  });
});
