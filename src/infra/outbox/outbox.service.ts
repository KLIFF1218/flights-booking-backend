import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxStatus, EnumTransport, Prisma } from '@prisma/client';
import { PrismaClient } from './types/prisma.client';
import {
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STALE_PROCESSING_MS,
  calculateOutboxRetryDelayMs,
} from './outbox.constants';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { isBookingOutboxTopic } from 'src/modules/bookings/metrics/booking-metrics.util';

@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  async enqueue(
    client: PrismaClient,
    {
      aggregateId,
      aggregateType,
      topic,
      key,
      payload,
      transport = EnumTransport.KAFKA,
    }: {
      aggregateId?: string;
      aggregateType?: string;
      topic: string;
      key?: string;
      payload: Prisma.InputJsonValue;
      transport?: EnumTransport;
    },
  ) {
    const msg = await client.outboxMessage.create({
      data: {
        aggregateId,
        aggregateType,
        topic,
        key,
        payload,
        transport,
        status: OutboxStatus.PENDING,
      },
    });

    this.logger.debug(`Enqueued outbox message ${msg.id} topic=${topic}`);

    if (isBookingOutboxTopic(topic)) {
      this.bookingMetrics.recordOutboxEnqueued(topic, transport);
    }

    return msg;
  }

  async fetchPending(limit = 50) {
    return this.prisma.outboxMessage.findMany({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  }

  async tryMarkProcessing(id: string): Promise<boolean> {
    const result = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        status: OutboxStatus.PENDING,
      },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: {
          increment: 1,
        },
        availableAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async markSent(id: string): Promise<boolean> {
    const result = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        status: OutboxStatus.PROCESSING,
      },
      data: {
        status: OutboxStatus.SENT,
        processedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  async scheduleRetry(id: string, err: unknown) {
    const msg = await this.prisma.outboxMessage.findUnique({ where: { id } });

    if (!msg) {
      throw new Error(`Outbox message ${id} not found`);
    }

    if (msg.attempts >= OUTBOX_MAX_ATTEMPTS) {
      return this.markFailed(id, err);
    }

    const delayMs = calculateOutboxRetryDelayMs(msg.attempts);
    const availableAt = new Date(Date.now() + delayMs);

    const updated = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        status: OutboxStatus.PROCESSING,
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt,
        lastError: String(err),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    this.logger.warn(
      `Outbox message ${id} scheduled for retry in ${delayMs}ms (attempt ${msg.attempts}/${OUTBOX_MAX_ATTEMPTS}): ${String(err)}`,
    );

    if (isBookingOutboxTopic(msg.topic)) {
      this.bookingMetrics.recordOutboxRetry(msg.topic, msg.transport);
    }

    return updated;
  }

  async markFailed(id: string, err: unknown) {
    const result = await this.prisma.outboxMessage.updateMany({
      where: {
        id,
        status: OutboxStatus.PROCESSING,
      },
      data: {
        status: OutboxStatus.FAILED,
        lastError: String(err),
        processedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    const msg = await this.prisma.outboxMessage.findUnique({ where: { id } });
    if (!msg) {
      return null;
    }

    this.logger.warn(`Outbox message ${id} permanently failed: ${msg.lastError}`);

    if (isBookingOutboxTopic(msg.topic)) {
      this.bookingMetrics.recordOutboxFailed(msg.topic, msg.transport);
    }

    return msg;
  }

  async reclaimStaleProcessing(staleAfterMs = OUTBOX_STALE_PROCESSING_MS): Promise<number> {
    const staleBefore = new Date(Date.now() - staleAfterMs);

    const reclaimed = await this.prisma.outboxMessage.updateMany({
      where: {
        status: OutboxStatus.PROCESSING,
        availableAt: {
          lt: staleBefore,
        },
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt: new Date(),
        lastError: 'Reclaimed stale processing lock',
      },
    });

    if (reclaimed.count > 0) {
      this.logger.warn(`Reclaimed ${reclaimed.count} stale outbox messages`);
    }

    return reclaimed.count;
  }
}
