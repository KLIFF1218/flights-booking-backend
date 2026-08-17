import { BookingStatus, PassengerType } from '@prisma/client';
import { ProcessBookingTicketingUseCase } from './process-booking-ticketing.use-case';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type TicketIssuerService } from '../services/ticket-issuer.service';
import { type MailService } from 'src/infra/mail/mail.service';
import { type BookingsCacheService } from 'src/modules/bookings/services/bookings-cache.service';
import { type Logger } from 'nestjs-pino';
import { TicketingErrorCode } from '../errors/ticketing.errors';

describe('ProcessBookingTicketingUseCase', () => {
  let useCase: ProcessBookingTicketingUseCase;

  const prisma = {
    booking: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ticket: {
      count: jest.fn(),
    },
  };
  const ticketIssuer = {
    prefetchTicketsByTravelerId: jest.fn().mockResolvedValue(new Map()),
    issueForTraveler: jest.fn(),
  };
  const mailService = {
    sendBookingSuccess: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
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
    useCase = new ProcessBookingTicketingUseCase(
      prisma as unknown as PrismaService,
      ticketIssuer as unknown as TicketIssuerService,
      mailService as unknown as MailService,
      bookingsCache as unknown as BookingsCacheService,
      logger as unknown as Logger,
    );
  });

  it('issues tickets, sends mail before TICKETED, and invalidates cache', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: 'SC-ABCDEF123456',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await useCase.execute('booking-1');

    expect(prisma.booking.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'booking-1', status: BookingStatus.PAID },
      data: { status: BookingStatus.TICKETING },
    });
    expect(ticketIssuer.prefetchTicketsByTravelerId).toHaveBeenCalledWith('booking-1');
    expect(ticketIssuer.issueForTraveler).toHaveBeenCalled();
    expect(mailService.sendBookingSuccess).toHaveBeenCalled();
    const mailOrder = mailService.sendBookingSuccess.mock.invocationCallOrder[0];
    const ticketedOrder = prisma.booking.updateMany.mock.invocationCallOrder.find(
      (_order, index) =>
        prisma.booking.updateMany.mock.calls[index]?.[0]?.data?.status === BookingStatus.TICKETED,
    );
    expect(mailOrder).toBeLessThan(ticketedOrder ?? Number.MAX_SAFE_INTEGER);
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('skips already ticketed bookings', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      status: BookingStatus.TICKETED,
    });

    await useCase.execute('booking-1');

    expect(ticketIssuer.issueForTraveler).not.toHaveBeenCalled();
    expect(mailService.sendBookingSuccess).not.toHaveBeenCalled();
  });

  it('retries from TICKETING without resetting status', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      status: BookingStatus.TICKETING,
    });
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: 'SC-ABCDEF123456',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await useCase.execute('booking-1');

    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: { in: [BookingStatus.PAID, BookingStatus.TICKETING] },
      },
      data: { status: BookingStatus.TICKETED },
    });
  });

  it('throws INCOMPLETE_ISSUANCE when ticket count is insufficient', async () => {
    prisma.booking.findUnique.mockResolvedValue(booking);
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(0);

    await expect(useCase.execute('booking-1')).rejects.toMatchObject({
      code: TicketingErrorCode.INCOMPLETE_ISSUANCE,
    });
    expect(mailService.sendBookingSuccess).not.toHaveBeenCalled();
  });

  it('does not send success email when user email is missing', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...booking,
      user: { id: 'user-1', email: null },
    });
    ticketIssuer.issueForTraveler.mockResolvedValue({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    prisma.ticket.count.mockResolvedValue(1);

    await useCase.execute('booking-1');

    expect(mailService.sendBookingSuccess).not.toHaveBeenCalled();
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });
});
