import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, type Consumer } from 'kafkajs';
import { Logger } from 'nestjs-pino';
import { BookingNotificationsService } from 'src/infra/notifications/booking-notifications.service';
import { parseKafkaDomainTopics } from './domain-event.constants';
import { normalizeDomainEventEnvelope, parseKafkaMessageJson } from './kafka-domain-message.util';

@Injectable()
export class BookingNotificationsConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumer: Consumer;
  private readonly groupId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly notifications: BookingNotificationsService,
  ) {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    this.groupId = this.config.get<string>(
      'KAFKA_NOTIFICATIONS_CONSUMER_GROUP',
      'booking-notifications',
    );

    this.kafka = new Kafka({
      clientId: `${this.config.get<string>('KAFKA_CLIENT_ID', 'max-airline')}-notifications`,
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
  }

  async onModuleInit() {
    const topics = parseKafkaDomainTopics(this.config.get<string>('KAFKA_DOMAIN_TOPICS'));

    try {
      await this.consumer.connect();
      this.logger.log(`Connected Kafka notifications consumer group ${this.groupId}`);

      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.log(`Notifications consumer subscribed to ${topic}`);
      }

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const parsed = parseKafkaMessageJson(message.value?.toString());
          if (parsed === null) {
            this.logger.warn(
              { topic, partition, offset: message.offset },
              'Skipping invalid Kafka JSON payload for notifications',
            );
            return;
          }

          const envelope = normalizeDomainEventEnvelope(topic, parsed, message.offset);
          await this.notifications.handleDomainEvent(envelope);
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err : String(err) },
        'Failed to start Kafka notifications consumer',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Kafka notifications consumer disconnected');
    } catch (err: unknown) {
      this.logger.warn({ err }, 'Failed to disconnect Kafka notifications consumer');
    }
  }
}
