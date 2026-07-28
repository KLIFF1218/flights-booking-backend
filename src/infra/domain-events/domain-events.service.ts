import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import {
  type DomainEventEnvelope,
  resolveBookingIdFromEnvelope,
} from 'src/infra/kafka/domain-event-envelope.util';

export type PersistDomainEventInput = {
  envelope: DomainEventEnvelope;
  kafkaTopic: string;
  kafkaPartition: number;
  kafkaOffset: string;
};

@Injectable()
export class DomainEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async persistFromKafka(input: PersistDomainEventInput): Promise<'created' | 'duplicate'> {
    const idempotencyKey = `${input.kafkaTopic}:${input.kafkaPartition}:${input.kafkaOffset}`;
    const bookingId = resolveBookingIdFromEnvelope(input.envelope);

    try {
      await this.prisma.domainEvent.create({
        data: {
          eventId: input.envelope.eventId,
          eventType: input.envelope.eventType,
          aggregateType: input.envelope.aggregateType,
          aggregateId: input.envelope.aggregateId,
          bookingId,
          payload: input.envelope.payload as Prisma.InputJsonValue,
          occurredAt: new Date(input.envelope.occurredAt),
          idempotencyKey,
          kafkaTopic: input.kafkaTopic,
          kafkaPartition: input.kafkaPartition,
          kafkaOffset: input.kafkaOffset,
        },
      });

      return 'created';
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        this.logger.debug({ idempotencyKey }, 'Domain event already persisted');
        return 'duplicate';
      }

      throw error;
    }
  }

  async findByBookingId(bookingId: string) {
    return this.prisma.domainEvent.findMany({
      where: { bookingId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
