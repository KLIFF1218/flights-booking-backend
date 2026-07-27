import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus, TicketStatus, TransactionStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { BookingsService } from './bookings.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingsCacheService } from './bookings-cache.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { SeatReleaseService } from './seat-release.service';
import { PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC } from '../constants/booking-outbox.constants';
import { createBookingMetricsMock } from '../metrics/booking-metrics.mock';
import { BookingMetricsService } from '../metrics/booking-metrics.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let module: TestingModule;

  const prisma = {
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
    getUserBookingsList: jest.fn().mockResolvedValue(null),
    saveUserBookingsList: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const metrics = createBookingMetricsMock();
  const seatReleaseService = {
    releaseSeatsForBooking: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: { debug: jest.fn() } },
        { provide: BookingsCacheService, useValue: bookingsCache },
        { provide: OutboxService, useValue: outbox },
        { provide: SeatReleaseService, useValue: seatReleaseService },
        { provide: BookingMetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('does not expose ticket urls when booking is not ticketed', async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'booking-1',
          userId: 'user-1',
          status: BookingStatus.PAID,
          pnrLocator: 'ABC123',
          totalPrice: 10000,
          currency: 'RUB',
          flightOrderId: 'order-1',
          createdAt: new Date(),
          lastTicketingDate: new Date(),
          provider: 'MOCK',
          snapshot: {
            offer: {
              itineraries: [
                {
                  segments: [
                    {
                      id: 'seg-1',
                      carrierCode: 'SU',
                      number: '100',
                      departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
                      arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
                    },
                  ],
                },
              ],
            },
            pricing: { travelers: [] },
          },
          travelers: [],
          seatAssignments: [],
          transaction: null,
          tickets: [
            {
              id: 'ticket-1',
              travelerId: 'traveler-1',
              ticketNumber: 'SC-123',
              status: TicketStatus.ISSUED,
              pdfKey: 'tickets/booking-1/traveler-1.pdf',
            },
          ],
        },
      ],
      1,
    ]);

    const result = await service.findAllByUser('user-1');

    expect(result.bookings[0].tickets).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('exposes ticket metadata for ticketed bookings without generating presigned urls', async () => {
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'booking-1',
          userId: 'user-1',
          status: BookingStatus.TICKETED,
          pnrLocator: 'ABC123',
          totalPrice: 10000,
          currency: 'RUB',
          flightOrderId: 'order-1',
          createdAt: new Date(),
          lastTicketingDate: new Date(),
          provider: 'MOCK',
          snapshot: {
            offer: {
              itineraries: [
                {
                  segments: [
                    {
                      carrierCode: 'SU',
                      number: '100',
                      departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
                      arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
                    },
                  ],
                },
              ],
            },
            pricing: { travelers: [] },
          },
          travelers: [],
          seatAssignments: [],
          transaction: null,
          tickets: [
            {
              id: 'ticket-1',
              travelerId: 'traveler-1',
              ticketNumber: 'SC-123',
              status: TicketStatus.ISSUED,
              pdfKey: 'tickets/booking-1/traveler-1.pdf',
            },
          ],
        },
      ],
      1,
    ]);

    const result = await service.findAllByUser('user-1');

    expect(result.bookings[0].tickets).toEqual([
      {
        id: 'ticket-1',
        travelerId: 'traveler-1',
        ticketNumber: 'SC-123',
        status: TicketStatus.ISSUED,
      },
    ]);
  });

  it('releases seats and enqueues provider cancel outbox when user cancels booking', async () => {
    const canceledBooking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.CANCELED,
      transaction: { id: 'tx-1', status: TransactionStatus.CANCELED },
    };

    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAYMENT_PENDING,
      provider: 'MOCK',
      snapshot: {
        offer: {
          itineraries: [
            {
              segments: [{ flightInstanceId: 'instance-1' }],
            },
          ],
        },
        pricing: { travelers: [{}] },
      },
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
        provider: 'YOOKASSA',
        externalId: 'pay-1',
      },
    });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(canceledBooking),
        },
        transaction: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn(),
        },
        traveler: {
          count: jest.fn().mockResolvedValue(1),
        },
        flightInstance: {
          findUnique: jest.fn().mockResolvedValue({
            seatsAvailable: 10,
            _count: { seats: 180 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        outboxMessage: {
          create: jest.fn(),
        },
      }),
    );

    const result = await service.cancel('booking-1', 'user-1');

    expect(seatReleaseService.releaseSeatsForBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Object),
      'cancel',
    );
    expect(result).toEqual(canceledBooking);
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        aggregateId: 'booking-1',
        aggregateType: 'Booking',
        topic: PAYMENT_PENDING_CANCEL_OUTBOX_TOPIC,
        payload: {
          transactionId: 'tx-1',
          provider: 'YOOKASSA',
          externalId: 'pay-1',
        },
      }),
    );
  });

  it('rejects cancel for paid bookings', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAID,
      transaction: null,
    });

    await expect(service.cancel('booking-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns booking unchanged when already canceled', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.CANCELED,
      transaction: null,
    };

    prisma.booking.findFirst.mockResolvedValue(booking);

    const result = await service.cancel('booking-1', 'user-1');

    expect(result).toBe(booking);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
