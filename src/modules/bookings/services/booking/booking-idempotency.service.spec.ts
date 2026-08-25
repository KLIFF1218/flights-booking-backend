import { BookingIdempotencyService } from '../booking/booking-idempotency.service';
import { IdempotencyStatus } from '@prisma/client';

describe('BookingIdempotencyService', () => {
  const mockPrisma = {
    bookingIdempotencyRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  let service: BookingIdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingIdempotencyService(mockPrisma as never);
  });

  it('starts a new idempotency record', async () => {
    const created = { id: 'rec_1', status: IdempotencyStatus.PROCESSING };
    mockPrisma.bookingIdempotencyRecord.create.mockResolvedValue(created);

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'new',
      record: created,
    });
  });

  it('replays completed response', async () => {
    mockPrisma.bookingIdempotencyRecord.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.bookingIdempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec_1',
      status: IdempotencyStatus.COMPLETED,
      response: { id: 'booking-1' },
      updatedAt: new Date(),
    });

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'replay',
      response: { id: 'booking-1' },
    });
  });

  it('returns in_progress for active processing record', async () => {
    mockPrisma.bookingIdempotencyRecord.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.bookingIdempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec_1',
      status: IdempotencyStatus.PROCESSING,
      response: null,
      updatedAt: new Date(),
    });

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'in_progress',
    });
  });

  it('reclaims failed records atomically', async () => {
    mockPrisma.bookingIdempotencyRecord.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.bookingIdempotencyRecord.findUnique
      .mockResolvedValueOnce({
        id: 'rec_1',
        status: IdempotencyStatus.FAILED,
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
      });
    mockPrisma.bookingIdempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'new',
      record: {
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
      },
    });

    expect(mockPrisma.bookingIdempotencyRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'rec_1',
        status: IdempotencyStatus.FAILED,
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });
  });

  it('returns in_progress when another worker reclaimed a failed record first', async () => {
    mockPrisma.bookingIdempotencyRecord.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.bookingIdempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec_1',
      status: IdempotencyStatus.FAILED,
      updatedAt: new Date(),
    });
    mockPrisma.bookingIdempotencyRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'in_progress',
    });
  });

  it('reclaims stale processing records atomically', async () => {
    mockPrisma.bookingIdempotencyRecord.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.bookingIdempotencyRecord.findUnique
      .mockResolvedValueOnce({
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
        updatedAt: new Date(Date.now() - 10 * 60_000),
      })
      .mockResolvedValueOnce({
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
      });
    mockPrisma.bookingIdempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.tryStart('user-1', 'key-1')).resolves.toEqual({
      kind: 'new',
      record: {
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
      },
    });

    expect(mockPrisma.bookingIdempotencyRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'rec_1',
        status: IdempotencyStatus.PROCESSING,
        updatedAt: {
          lte: expect.any(Date),
        },
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });
  });
});
