import { Test, type TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { IdempotencyStatus, PaymentProvider } from '@prisma/client';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  const mockPrisma = {
    idempotencyOperation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [IdempotencyService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  it('should create a new processing operation', async () => {
    const created = { id: 'op_1', status: IdempotencyStatus.PROCESSING };
    mockPrisma.idempotencyOperation.create.mockResolvedValue(created);

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toEqual(created);
  });

  it('should return null for completed operations', async () => {
    mockPrisma.idempotencyOperation.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.idempotencyOperation.findUnique.mockResolvedValue({
      id: 'op_1',
      status: IdempotencyStatus.COMPLETED,
      updatedAt: new Date(),
    });

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toBeNull();
  });

  it('should retry failed operations atomically', async () => {
    mockPrisma.idempotencyOperation.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.idempotencyOperation.findUnique
      .mockResolvedValueOnce({
        id: 'op_1',
        status: IdempotencyStatus.FAILED,
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'op_1',
        status: IdempotencyStatus.PROCESSING,
      });
    mockPrisma.idempotencyOperation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toEqual({
      id: 'op_1',
      status: IdempotencyStatus.PROCESSING,
    });

    expect(mockPrisma.idempotencyOperation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'op_1',
        status: IdempotencyStatus.FAILED,
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });
  });

  it('should return null when another worker reclaimed a failed operation first', async () => {
    mockPrisma.idempotencyOperation.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.idempotencyOperation.findUnique.mockResolvedValue({
      id: 'op_1',
      status: IdempotencyStatus.FAILED,
      updatedAt: new Date(),
    });
    mockPrisma.idempotencyOperation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toBeNull();
  });

  it('should block duplicate in-flight operations', async () => {
    mockPrisma.idempotencyOperation.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.idempotencyOperation.findUnique.mockResolvedValue({
      id: 'op_1',
      status: IdempotencyStatus.PROCESSING,
      updatedAt: new Date(),
    });

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toBeNull();
  });

  it('should reclaim stale processing operations atomically', async () => {
    mockPrisma.idempotencyOperation.create.mockRejectedValue(new Error('duplicate'));
    mockPrisma.idempotencyOperation.findUnique
      .mockResolvedValueOnce({
        id: 'op_1',
        status: IdempotencyStatus.PROCESSING,
        updatedAt: new Date(Date.now() - 10 * 60_000),
      })
      .mockResolvedValueOnce({
        id: 'op_1',
        status: IdempotencyStatus.PROCESSING,
      });
    mockPrisma.idempotencyOperation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.tryStart(PaymentProvider.STRIPE, 'event_1', 'payment-webhook'),
    ).resolves.toEqual({
      id: 'op_1',
      status: IdempotencyStatus.PROCESSING,
    });

    expect(mockPrisma.idempotencyOperation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'op_1',
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
