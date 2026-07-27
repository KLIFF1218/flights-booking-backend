import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingWorkflowService } from './booking-workflow.service';
import { createBookingMetricsMock } from '../metrics/booking-metrics.mock';

jest.mock('src/common/utils/retry-with-backoff.util', () => ({
  retryWithExponentialBackoff: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

describe('BookingWorkflowService', () => {
  const searchStore = {
    getOffer: jest.fn(),
  };
  const bookingCreationService = {
    createBooking: jest.fn(),
  };
  const prisma = {
    booking: {
      findFirst: jest.fn(),
    },
  };
  const bookingsCache = {
    getBookingDetail: jest.fn(),
    saveBookingDetail: jest.fn(),
    invalidateBooking: jest.fn(),
  };
  const bookingTravelerService = {
    addTravelers: jest.fn(),
  };
  const bookingSeatService = {
    assignSeats: jest.fn(),
  };
  const bookingCheckoutService = {
    checkout: jest.fn(),
  };
  const bookingExpirationService = {
    expireIfNeeded: jest.fn(),
  };
  const bookingsService = {
    cancel: jest.fn(),
    compensateFailedCreateBooking: jest.fn(),
  };
  const bookingIdempotency = {
    tryStart: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    attachBooking: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
  };
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();

  let service: BookingWorkflowService;

  const dto = {
    searchId: 'search-1',
    offerId: 'offer-1',
    travelers: [
      {
        id: 'trav-1',
        gender: 'MALE',
        dateOfBirth: '1990-01-01',
        name: { firstName: 'John', lastName: 'Doe' },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingWorkflowService(
      searchStore as never,
      bookingCreationService as never,
      prisma as never,
      bookingsCache as never,
      bookingTravelerService as never,
      bookingSeatService as never,
      bookingCheckoutService as never,
      bookingExpirationService as never,
      bookingsService as never,
      bookingIdempotency as never,
      outbox as never,
      logger as never,
      bookingMetrics,
    );
    searchStore.getOffer.mockResolvedValue({ id: 'offer-1' });
    bookingCreationService.createBooking.mockResolvedValue({ id: 'booking-1' });
    bookingTravelerService.addTravelers.mockResolvedValue(undefined);
    bookingIdempotency.tryStart.mockResolvedValue({
      kind: 'new',
      record: { id: 'rec-1' },
    });
    outbox.enqueue.mockResolvedValue({ id: 'outbox-1' });
  });

  it('replays completed idempotent create booking response', async () => {
    bookingIdempotency.tryStart.mockResolvedValue({
      kind: 'replay',
      response: { id: 'booking-1' },
    });

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).resolves.toEqual({
      id: 'booking-1',
    });
    expect(bookingCreationService.createBooking).not.toHaveBeenCalled();
  });

  it('rejects duplicate in-flight idempotent create booking request', async () => {
    bookingIdempotency.tryStart.mockResolvedValue({ kind: 'in_progress' });

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects create booking without idempotency key', async () => {
    await expect(service.createBooking(dto as never, 'user-1', '')).rejects.toThrow(
      BadRequestException,
    );
    expect(bookingIdempotency.tryStart).not.toHaveBeenCalled();
  });

  it('compensates with retry when traveler persistence fails', async () => {
    bookingTravelerService.addTravelers.mockRejectedValue(new Error('db error'));
    bookingsService.compensateFailedCreateBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'CANCELED',
    });

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).rejects.toThrow(
      'db error',
    );

    expect(bookingsService.compensateFailedCreateBooking).toHaveBeenCalledWith(
      'booking-1',
      'user-1',
    );
  });

  it('records dead-letter metric when compensation cancel fails', async () => {
    bookingTravelerService.addTravelers.mockRejectedValue(new Error('db error'));
    bookingsService.compensateFailedCreateBooking.mockRejectedValue(new Error('cancel failed'));

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).rejects.toThrow(
      'db error',
    );

    expect(bookingMetrics.recordCreateCompensationFailed).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        topic: 'booking.create.compensation',
        payload: { bookingId: 'booking-1', userId: 'user-1' },
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1' }),
      'DEAD LETTER: failed to compensate booking after create workflow error',
    );
  });

  it('completes idempotent request after successful create', async () => {
    bookingIdempotency.tryStart.mockResolvedValue({
      kind: 'new',
      record: { id: 'rec-1' },
    });
    prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1', travelers: [] });

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).resolves.toEqual({
      id: 'booking-1',
      travelers: [],
    });

    expect(bookingIdempotency.attachBooking).toHaveBeenCalledWith('rec-1', 'booking-1');
    expect(bookingIdempotency.complete).toHaveBeenCalledWith(
      'rec-1',
      { id: 'booking-1', travelers: [] },
      'booking-1',
    );
  });

  it('throws not found when offer is missing', async () => {
    searchStore.getOffer.mockResolvedValue(null);

    await expect(service.createBooking(dto as never, 'user-1', 'idem-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
