import { BookingStatus, PassengerType } from '@prisma/client';
import { TicketingProcessor } from './ticketing.processor';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type TicketIssuerService } from './services/ticket-issuer.service';
import { type MailService } from 'src/infra/mail/mail.service';
import { type BookingsCacheService } from '../bookings/services/bookings-cache.service';
import { type Logger } from 'nestjs-pino';
import { TicketingUnrecoverableError, TicketingErrorCode } from './errors/ticketing.errors';
import { createBookingMetricsMock } from '../bookings/metrics/booking-metrics.mock';
import { type OutboxService } from 'src/infra/outbox/outbox.service';

describe('TicketingProcessor', () => {
  let processor: TicketingProcessor;

  const prisma = {
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ticket: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const ticketIssuer = {
    issueForTraveler: jest.fn(),
  };
  const mailService = {
    sendBookingSuccess: jest.fn(),
    sendBookingFailed: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();
  const metrics = {
    recordTicketingCompleted: jest.fn(),
    recordTicketingFailed: jest.fn(),
    recordTicketingDuration: jest.fn(),
  };

  const booking = {
    id: 'booking-1',
    status: BookingStatus.PAID,
    pnrLocator: 'ABC123',
    userId: 'user-1',
    snapshot: {
      offer: {
        itineraries: [
          {
            segments: [
              {
                id: 'seg-1',
                number: '100',
                carrierCode: 'SU',
                departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
                arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
              },
            ],
          },
        ],
      },
      pricing: {
        id: 'pricing-1',
        price: {
          base: 10000,
          taxes: 0,
          fees: 0,
          taxItems: [],
          feeItems: [],
          seats: 0,
          total: 10000,
          currency: 'RUB',
        },
        travelers: [
          {
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: PassengerType.ADULT,
            price: {
              currency: 'RUB',
              total: '10000',
              base: '10000',
            },
            fareDetailsBySegment: [],
          },
        ],
        outbound: {
          from: 'SVO',
          to: 'LED',
          departureTime: '2026-08-01T10:00:00',
          arrivalTime: '2026-08-01T12:00:00',
          durationMinutes: 120,
          stops: 0,
          segments: [],
        },
      },
    },
    user: { id: 'user-1', email: 'user@example.com' },
    travelers: [
      {
        id: 'traveler-1',
        firstName: 'John',
        lastName: 'Doe',
        passengerType: PassengerType.ADULT,
        createdAt: new Date('2026-01-01'),
        seatAssignments: [],
      },
    ],
    tickets: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TicketingProcessor(
      prisma as unknown as PrismaService,
      ticketIssuer as unknown as TicketIssuerService,
      mailService as unknown as MailService,
      bookingsCache as unknown as BookingsCacheService,
      outbox as unknown as OutboxService,
      bookingMetrics,
      metrics as never,
      logger as unknown as Logger,
    );
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );
    outbox.enqueue.mockResolvedValue({ id: 'outbox-1' });
  });

  it('issues tickets and marks booking as TICKETED', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.update.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: 'SC-ABCDEF123456',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(prisma.booking.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'booking-1' },
      data: { status: BookingStatus.TICKETING },
    });
    expect(ticketIssuer.issueForTraveler).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        pnrLocator: 'ABC123',
        traveler: expect.objectContaining({ id: 'traveler-1' }),
        travelerPricing: expect.objectContaining({ travelerId: '1' }),
      }),
    );
    expect(prisma.booking.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'booking-1' },
      data: { status: BookingStatus.TICKETED },
    });
    expect(mailService.sendBookingSuccess).toHaveBeenCalled();
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('skips already ticketed bookings', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      status: BookingStatus.TICKETED,
    });

    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(ticketIssuer.issueForTraveler).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('retries from TICKETING without resetting status', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      status: BookingStatus.TICKETING,
    });
    prisma.booking.update.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: 'SC-ABCDEF123456',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.TICKETED },
    });
  });

  it('skips bookings that are not eligible for ticketing', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      status: BookingStatus.PAYMENT_PENDING,
    });

    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(ticketIssuer.issueForTraveler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('escalates ticketing failure via outbox when booking has no travelers', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        ...booking,
        travelers: [],
      })
      .mockResolvedValueOnce({
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      TicketingUnrecoverableError,
    );

    expect(outbox.enqueue).toHaveBeenCalled();
    expect(mailService.sendBookingFailed).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      'booking-1',
    );
    expect(bookingMetrics.recordOutboxEnqueued).toHaveBeenCalledWith(
      'booking.ticketing.failed',
      'INTERNAL',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1' }),
      'Ticketing failure escalated via outbox compensation workflow',
    );
  });

  it('escalates when booking is not found', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      TicketingUnrecoverableError,
    );

    expect(outbox.enqueue).toHaveBeenCalled();
    expect(metrics.recordTicketingFailed).toHaveBeenCalled();
  });

  it('escalates when booking snapshot is missing', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        ...booking,
        snapshot: null,
      })
      .mockResolvedValueOnce({
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toMatchObject(
      {
        code: TicketingErrorCode.SNAPSHOT_MISSING,
      },
    );

    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('escalates when traveler pricing is missing', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        ...booking,
        snapshot: {
          ...booking.snapshot,
          pricing: {
            ...booking.snapshot.pricing,
            travelers: [],
          },
        },
      })
      .mockResolvedValueOnce({
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });
    prisma.booking.update.mockResolvedValue(booking);

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toMatchObject(
      {
        code: TicketingErrorCode.PRICING_NOT_FOUND,
      },
    );

    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('does not send success email when user email is missing', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      user: { id: 'user-1', email: null },
    });
    prisma.booking.update.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(mailService.sendBookingSuccess).not.toHaveBeenCalled();
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('rethrows recoverable errors without escalation', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.update.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockRejectedValue(new Error('pdf generation failed'));

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      'pdf generation failed',
    );

    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(mailService.sendBookingFailed).not.toHaveBeenCalled();
    expect(metrics.recordTicketingFailed).toHaveBeenCalled();
  });

  it('rethrows when not all tickets were issued without escalation', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.update.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(0);

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      'Not all tickets were issued',
    );

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('logs when booking-failed email cannot be sent after escalation', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        ...booking,
        travelers: [],
      })
      .mockResolvedValueOnce({
        userId: 'user-1',
        user: { email: 'user@example.com' },
      });
    mailService.sendBookingFailed.mockRejectedValue(new Error('smtp down'));

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      TicketingUnrecoverableError,
    );

    expect(outbox.enqueue).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        err: expect.any(Error),
      }),
      'Failed to enqueue booking-failed email after ticketing failure',
    );
  });
});
