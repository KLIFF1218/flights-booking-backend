import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, type Consumer } from 'kafkajs';
import { Logger } from 'nestjs-pino';
import { DomainEventsService } from 'src/infra/domain-events/domain-events.service';
import { parseKafkaDomainTopics } from './domain-event.constants';
import { resolveBookingIdFromEnvelope } from './domain-event-envelope.util';
import { normalizeDomainEventEnvelope, parseKafkaMessageJson } from './kafka-domain-message.util';

@Injectable()
export class BookingAuditConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private readonly groupId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly domainEvents: DomainEventsService,
  ) {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    this.groupId = this.config.get<string>('KAFKA_AUDIT_CONSUMER_GROUP', 'booking-audit');

    this.kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'max-airline'),
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
  }

  async onModuleInit() {
    const topics = parseKafkaDomainTopics(this.config.get<string>('KAFKA_DOMAIN_TOPICS'));

    try {
      await this.consumer.connect();
      this.logger.log(`Connected Kafka audit consumer group ${this.groupId}`);

      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.log(`Audit consumer subscribed to ${topic}`);
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const parsed = parseKafkaMessageJson(message.value?.toString());
          if (parsed === null) {
            return;
          }

          const envelope = normalizeDomainEventEnvelope(topic, parsed, message.offset);
          const result = await this.domainEvents.persistFromKafka({
            envelope,
            kafkaTopic: topic,
            kafkaPartition: partition,
            kafkaOffset: message.offset,
          });

          if (result === 'created') {
            this.logger.debug(
              {
                topic,
                partition,
                offset: message.offset,
                eventType: envelope.eventType,
                bookingId: resolveBookingIdFromEnvelope(envelope),
              },
              'Domain event persisted',
            );
          }
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err : String(err) },
        'Failed to start Kafka audit consumer',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Kafka audit consumer disconnected');
    } catch (err: unknown) {
      this.logger.warn({ err }, 'Failed to disconnect Kafka audit consumer');
    }
  }
}
