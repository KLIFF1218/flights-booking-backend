import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxStatus, EnumTransport } from '@prisma/client';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  constructor(private readonly prisma: PrismaService) {}

  async enqueue({
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
    payload: any;
    transport?: EnumTransport;
  }) {
    const msg = await this.prisma.outboxMessage.create({
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
    return msg;
  }

  async fetchPending(limit = 50) {
    return this.prisma.outboxMessage.findMany({
      where: {
        status: OutboxStatus.PENDING,
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markProcessing(id: string) {
    return this.prisma.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 } },
    });
  }

  async markSent(id: string) {
    return this.prisma.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.SENT, processedAt: new Date() },
    });
  }

  async markFailed(id: string, err: any) {
    const msg = await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.FAILED, lastError: String(err), processedAt: new Date() },
    });
    this.logger.warn(`Outbox message ${id} failed: ${msg.lastError}`);
    return msg;
  }
}
