import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, type Consumer } from 'kafkajs';
import { Logger } from 'nestjs-pino';
import { DomainAnalyticsService } from 'src/infra/analytics/domain-analytics.service';
import { parseKafkaDomainTopics } from './domain-event.constants';
import {
  normalizeDomainEventEnvelope,
  parseKafkaMessageJson,
} from './kafka-domain-message.util';

@Injectable()
export class BookingAnalyticsConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private readonly groupId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly analytics: DomainAnalyticsService,
  ) {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    this.groupId = this.config.get<string>(
      'KAFKA_ANALYTICS_CONSUMER_GROUP',
      'booking-analytics',
    );

    this.kafka = new Kafka({
      clientId: `${this.config.get<string>('KAFKA_CLIENT_ID', 'max-airline')}-analytics`,
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
  }

  async onModuleInit() {
    const topics = parseKafkaDomainTopics(this.config.get<string>('KAFKA_DOMAIN_TOPICS'));

    try {
      await this.consumer.connect();
      this.logger.log(`Connected Kafka analytics consumer group ${this.groupId}`);

      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.log(`Analytics consumer subscribed to ${topic}`);
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const parsed = parseKafkaMessageJson(message.value?.toString());
          if (parsed === null) {
            return;
          }

          const envelope = normalizeDomainEventEnvelope(topic, parsed, message.offset);
          const result = await this.analytics.applyDomainEvent(envelope);

          if (result === 'applied') {
            this.logger.debug(
              {
                topic,
                partition,
                offset: message.offset,
                eventType: envelope.eventType,
              },
              'Analytics projection updated',
            );
          }
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err : String(err) },
        'Failed to start Kafka analytics consumer',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Kafka analytics consumer disconnected');
    } catch (err: unknown) {
      this.logger.warn({ err }, 'Failed to disconnect Kafka analytics consumer');
    }
  }
}
