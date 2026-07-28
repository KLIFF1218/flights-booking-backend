import { BookingStatus, EnumTransport } from '@prisma/client';
import { escalateTicketingFailure } from './ticketing-failure-escalation.util';
import { BOOKING_TICKETING_FAILED_OUTBOX_TOPIC } from 'src/modules/bookings/constants/booking-outbox.constants';
import { TicketingErrorCode } from '../errors/ticketing.errors';
import { createBookingMetricsMock } from 'src/modules/bookings/metrics/booking-metrics.mock';

describe('escalateTicketingFailure', () => {
  const prisma = {
    $transaction: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();

  const deps = () => ({
    prisma: prisma as never,
    outbox: outbox as never,
    logger: logger as never,
    bookingMetrics,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    outbox.enqueue.mockResolvedValue({ id: 'outbox-1' });
  });

  it('enqueues internal and kafka outbox events and marks booking failed', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: { updateMany },
      }),
    );

    await escalateTicketingFailure(
      deps(),
      'booking-1',
      TicketingErrorCode.PRICING_NOT_FOUND,
      'user-1',
    );

    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        aggregateId: 'booking-1',
        topic: BOOKING_TICKETING_FAILED_OUTBOX_TOPIC,
        key: 'booking-1:ticketing-failed',
        transport: EnumTransport.INTERNAL,
        payload: {
          bookingId: 'booking-1',
          reason: TicketingErrorCode.PRICING_NOT_FOUND,
          userId: 'user-1',
        },
      }),
    );
    expect(outbox.enqueue).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({
        topic: 'booking.ticketing.failed',
        transport: EnumTransport.KAFKA,
        payload: expect.objectContaining({
          bookingId: 'booking-1',
          userId: 'user-1',
          reason: TicketingErrorCode.PRICING_NOT_FOUND,
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: { in: [BookingStatus.PAID, BookingStatus.TICKETING] },
      },
      data: { status: BookingStatus.FAILED },
    });
    expect(bookingMetrics.recordOutboxEnqueued).toHaveBeenCalledWith(
      BOOKING_TICKETING_FAILED_OUTBOX_TOPIC,
      EnumTransport.INTERNAL,
    );
    expect(logger.error).toHaveBeenCalledWith(
      { bookingId: 'booking-1', reason: TicketingErrorCode.PRICING_NOT_FOUND },
      'Ticketing failure escalated via outbox compensation workflow',
    );
  });

  it('records escalation failure when booking is no longer failable', async () => {
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        booking: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );

    await escalateTicketingFailure(deps(), 'booking-1', TicketingErrorCode.NO_TRAVELERS, 'user-1');

    expect(bookingMetrics.recordTicketingFailureEscalationFailed).toHaveBeenCalledWith(
      TicketingErrorCode.NO_TRAVELERS,
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1' }),
      'DEAD LETTER: failed to escalate ticketing failure',
    );
    expect(bookingMetrics.recordOutboxEnqueued).not.toHaveBeenCalled();
  });

  it('records escalation failure when transaction throws', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db unavailable'));

    await escalateTicketingFailure(
      deps(),
      'booking-1',
      TicketingErrorCode.SNAPSHOT_MISSING,
      'user-1',
    );

    expect(bookingMetrics.recordTicketingFailureEscalationFailed).toHaveBeenCalledWith(
      TicketingErrorCode.SNAPSHOT_MISSING,
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        err: expect.any(Error),
      }),
      'DEAD LETTER: failed to escalate ticketing failure',
    );
  });
});
