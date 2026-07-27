import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { IdempotencyOperation, IdempotencyStatus, PaymentProvider } from '@prisma/client';

const IDEMPOTENCY_STALE_PROCESSING_MS = 5 * 60_000;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async tryStart(
    provider: PaymentProvider,
    key: string,
    operation: string,
  ): Promise<IdempotencyOperation | null> {
    try {
      return await this.prisma.idempotencyOperation.create({
        data: {
          provider,
          key,
          operation,
          status: IdempotencyStatus.PROCESSING,
        },
      });
    } catch (error) {
      const existing = await this.prisma.idempotencyOperation.findUnique({
        where: {
          provider_key: {
            provider,
            key,
          },
        },
      });

      if (!existing) {
        throw error;
      }

      if (existing.status === IdempotencyStatus.COMPLETED) {
        return null;
      }

      if (existing.status === IdempotencyStatus.FAILED) {
        return this.tryReclaimFailed(existing.id);
      }

      if (
        existing.status === IdempotencyStatus.PROCESSING &&
        this.isStaleProcessing(existing.updatedAt)
      ) {
        return this.tryReclaimStale(existing.id);
      }

      return null;
    }
  }

  async complete(id: string): Promise<void> {
    await this.prisma.idempotencyOperation.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
      },
      data: {
        status: IdempotencyStatus.COMPLETED,
      },
    });
  }

  async fail(id: string): Promise<void> {
    await this.prisma.idempotencyOperation.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
      },
      data: {
        status: IdempotencyStatus.FAILED,
      },
    });
  }

  private async tryReclaimFailed(id: string): Promise<IdempotencyOperation | null> {
    const reclaimed = await this.prisma.idempotencyOperation.updateMany({
      where: {
        id,
        status: IdempotencyStatus.FAILED,
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });

    if (reclaimed.count !== 1) {
      return null;
    }

    return this.prisma.idempotencyOperation.findUnique({ where: { id } });
  }

  private async tryReclaimStale(id: string): Promise<IdempotencyOperation | null> {
    const staleBefore = new Date(Date.now() - IDEMPOTENCY_STALE_PROCESSING_MS);

    const reclaimed = await this.prisma.idempotencyOperation.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
        updatedAt: {
          lte: staleBefore,
        },
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });

    if (reclaimed.count !== 1) {
      return null;
    }

    return this.prisma.idempotencyOperation.findUnique({ where: { id } });
  }

  private isStaleProcessing(updatedAt: Date): boolean {
    return updatedAt.getTime() <= Date.now() - IDEMPOTENCY_STALE_PROCESSING_MS;
  }
}
