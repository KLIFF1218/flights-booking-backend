import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { MetricsService } from '../metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class KafkaPublisher implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'max-airline'),
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected');
    } catch (err: unknown) {
      this.logger.warn(
        { err: err instanceof Error ? err : String(err) },
        'Failed to connect Kafka producer',
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    } catch (err: unknown) {
      this.logger.warn({ err }, 'Failed to disconnect Kafka producer');
    }
  }

  async publish(topic: string, message: unknown, key?: string) {
    try {
      await this.producer.send({
        topic,
        messages: [{ key: key ?? undefined, value: JSON.stringify(message) }],
      });
      runSafely(() => this.metrics.recordKafkaPublish(topic, 'success'));
      this.logger.debug({ topic, key }, 'Kafka message published');
    } catch (err: unknown) {
      runSafely(() => this.metrics.recordKafkaPublish(topic, 'failure'));
      this.logger.error({ err, topic, key }, 'Failed to publish Kafka message');
      throw err;
    }
  }
}
