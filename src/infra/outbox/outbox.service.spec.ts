import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxStatus } from '@prisma/client';
import { OUTBOX_MAX_ATTEMPTS } from './outbox.constants';
import { Logger } from 'nestjs-pino';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { createBookingMetricsMock } from 'src/modules/bookings/metrics/booking-metrics.mock';

describe('OutboxService', () => {
  let service: OutboxService;

  const mockPrisma = {
    outboxMessage: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: Logger, useValue: { debug: jest.fn(), warn: jest.fn() } },
        { provide: BookingMetricsService, useValue: createBookingMetricsMock() },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  it('should claim pending outbox message atomically', async () => {
    mockPrisma.outboxMessage.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.tryMarkProcessing('msg_1')).resolves.toBe(true);

    expect(mockPrisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'msg_1',
        status: OutboxStatus.PENDING,
      },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        availableAt: expect.any(Date),
      },
    });
  });

  it('should not claim outbox message already taken by another worker', async () => {
    mockPrisma.outboxMessage.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.tryMarkProcessing('msg_1')).resolves.toBe(false);
  });

  it('should schedule retry with exponential backoff when attempts remain', async () => {
    mockPrisma.outboxMessage.findUnique.mockResolvedValue({
      id: 'msg_1',
      attempts: 2,
      topic: 'checkout.cleanup',
      transport: 'INTERNAL',
    });
    mockPrisma.outboxMessage.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.scheduleRetry('msg_1', new Error('network error'));

    expect(result).toEqual({ count: 1 });
    expect(mockPrisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'msg_1',
        status: OutboxStatus.PROCESSING,
      },
      data: expect.objectContaining({
        status: OutboxStatus.PENDING,
        lastError: 'Error: network error',
        availableAt: expect.any(Date),
      }),
    });
  });

  it('should permanently fail when max attempts are exceeded', async () => {
    mockPrisma.outboxMessage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.outboxMessage.findUnique.mockResolvedValue({
      id: 'msg_1',
      status: OutboxStatus.FAILED,
      lastError: 'Error: exhausted',
      topic: 'checkout.cleanup',
      transport: 'INTERNAL',
    });

    const result = await service.markFailed('msg_1', new Error('exhausted'));

    expect(result?.status).toBe(OutboxStatus.FAILED);
    expect(mockPrisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'msg_1',
        status: OutboxStatus.PROCESSING,
      },
      data: {
        status: OutboxStatus.FAILED,
        lastError: 'Error: exhausted',
        processedAt: expect.any(Date),
      },
    });
  });

  it('should reclaim stale processing messages', async () => {
    mockPrisma.outboxMessage.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.reclaimStaleProcessing()).resolves.toBe(2);

    expect(mockPrisma.outboxMessage.updateMany).toHaveBeenCalledWith({
      where: {
        status: OutboxStatus.PROCESSING,
        availableAt: {
          lt: expect.any(Date),
        },
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt: expect.any(Date),
        lastError: 'Reclaimed stale processing lock',
      },
    });
  });
});
