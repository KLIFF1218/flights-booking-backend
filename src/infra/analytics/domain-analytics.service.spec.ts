import { Prisma } from '@prisma/client';
import { DomainAnalyticsService } from './domain-analytics.service';

describe('DomainAnalyticsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    booking: { findUnique: jest.fn() },
    bookingAnalyticsDaily: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    processedAnalyticsEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    domainEvent: { findMany: jest.fn() },
  };

  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  };

  let service: DomainAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DomainAnalyticsService(prisma as never, logger as never);
  });

  it('applies booking.created to daily projection', async () => {
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        processedAnalyticsEvent: { create: jest.fn().mockResolvedValue({}) },
        bookingAnalyticsDaily: { upsert: jest.fn().mockResolvedValue({}) },
      };
      await callback(tx);
    });

    const result = await service.applyDomainEvent({
      eventId: 'evt-1',
      eventType: 'booking.created',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T12:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1' },
    });

    expect(result).toBe('applied');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('treats duplicate eventId as duplicate', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['eventId'] },
    });
    prisma.$transaction.mockRejectedValue(error);

    const result = await service.applyDomainEvent({
      eventId: 'evt-1',
      eventType: 'booking.paid',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T12:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1' },
    });

    expect(result).toBe('duplicate');
  });

  it('prefers booking.totalPrice over payload for booking.paid', async () => {
    prisma.booking.findUnique.mockResolvedValue({ totalPrice: new Prisma.Decimal(25000) });
    const upsert = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        processedAnalyticsEvent: { create: jest.fn().mockResolvedValue({}) },
        bookingAnalyticsDaily: { upsert },
      });
    });

    await service.applyDomainEvent({
      eventId: 'evt-paid',
      eventType: 'booking.paid',
      aggregateType: 'Booking',
      aggregateId: 'booking-1',
      occurredAt: '2026-07-26T12:00:00.000Z',
      schemaVersion: 1,
      payload: { bookingId: 'booking-1', totalPrice: 100 },
    });

    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      select: { totalPrice: true },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ paymentVolume: 25000 }),
      }),
    );
  });

  it('calculates event counts summary from daily aggregates', async () => {
    prisma.bookingAnalyticsDaily.findMany.mockResolvedValue([
      {
        date: new Date('2026-07-25T00:00:00.000Z'),
        bookingsCreated: 10,
        paymentsSucceeded: 6,
        paymentsFailed: 1,
        bookingsCanceled: 1,
        bookingsExpired: 1,
        ticketsIssued: 5,
        ticketingFailed: 2,
        flightsDelayed: 3,
        flightsCancelled: 1,
        paymentVolume: new Prisma.Decimal(60000),
      },
    ]);
    prisma.bookingAnalyticsDaily.aggregate.mockResolvedValue({
      _sum: {
        bookingsCreated: 10,
        paymentsSucceeded: 6,
        paymentsFailed: 1,
        bookingsCanceled: 1,
        bookingsExpired: 1,
        ticketsIssued: 5,
        ticketingFailed: 2,
        flightsDelayed: 3,
        flightsCancelled: 1,
        paymentVolume: new Prisma.Decimal(60000),
      },
    });
    prisma.processedAnalyticsEvent.findFirst.mockResolvedValue({
      processedAt: new Date('2026-07-26T16:00:00.000Z'),
    });
    prisma.processedAnalyticsEvent.count.mockResolvedValue(42);

    const summary = await service.getEventAnalytics(30);

    expect(summary.counts.bookingsCreated).toBe(10);
    expect(summary.counts.bookingsExpired).toBe(1);
    expect(summary.counts.ticketingFailed).toBe(2);
    expect(summary.counts.flightsDelayed).toBe(3);
    expect(summary.conversionRate).toBe(60);
    expect(summary.ticketRate).toBe(83.3);
    expect(summary.paymentVolume).toBe(60000);
    expect(summary.health.processedEventCount).toBe(42);
    expect(summary.dailyActivity).toHaveLength(1);
  });
});
