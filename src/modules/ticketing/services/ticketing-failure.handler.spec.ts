import { BookingStatus } from '@prisma/client';
import { TicketingFailureHandler } from './ticketing-failure.handler';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type OutboxService } from 'src/infra/outbox/outbox.service';
import { type MailService } from 'src/infra/mail/mail.service';
import { type Logger } from 'nestjs-pino';
import { TicketingErrorCode, TicketingUnrecoverableError } from '../errors/ticketing.errors';
import { createBookingMetricsMock } from 'src/modules/bookings/metrics/booking-metrics.mock';

describe('TicketingFailureHandler', () => {
  const prisma = {
    booking: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const mailService = {
    sendBookingFailed: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();
  const logger = {
    error: jest.fn(),
  };

  let handler: TicketingFailureHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TicketingFailureHandler(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
      mailService as unknown as MailService,
      bookingMetrics,
      logger as unknown as Logger,
    );
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }),
    );
    outbox.enqueue.mockResolvedValue({ id: 'outbox-1' });
  });

  it('escalates unrecoverable errors and sends failure email', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      userId: 'user-1',
      user: { email: 'user@example.com' },
    });

    const error = new TicketingUnrecoverableError(
      'No travelers',
      TicketingErrorCode.NO_TRAVELERS,
      'booking-1',
    );

    await handler.handleJobFailure(error, 'booking-1');

    expect(outbox.enqueue).toHaveBeenCalled();
    expect(mailService.sendBookingFailed).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      'booking-1',
    );
  });

  it('escalates exhausted retries when booking is still in ticketing flow', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      status: BookingStatus.TICKETING,
      userId: 'user-1',
      user: { email: 'user@example.com' },
    });

    await handler.handleExhaustedRetries('booking-1', new Error('pdf down'));

    expect(outbox.enqueue).toHaveBeenCalled();
    expect(bookingMetrics.recordOutboxEnqueued).toHaveBeenCalled();
  });

  it('skips exhausted-retry escalation when booking is already ticketed', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      status: BookingStatus.TICKETED,
      userId: 'user-1',
    });

    await handler.handleExhaustedRetries('booking-1', new Error('pdf down'));

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
