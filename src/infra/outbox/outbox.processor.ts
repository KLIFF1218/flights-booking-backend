import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';
import { KafkaPublisher } from 'src/infra/kafka/kafka.publisher';
import { BookingEventsPublisher } from 'src/infra/rabbitmq/booking-events.publisher';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  constructor(
    private readonly outbox: OutboxService,
    private readonly kafka: KafkaPublisher,
    private readonly rabbit: BookingEventsPublisher,
  ) {}

  @Cron('*/5 * * * * *')
  async handle() {
    const pending = await this.outbox.fetchPending(50);
    if (pending.length === 0) return;
    this.logger.debug(`Outbox processing ${pending.length} messages`);
    for (const msg of pending) {
      try {
        await this.outbox.markProcessing(msg.id);
        if (msg.transport === 'KAFKA') {
          await this.kafka.publish(msg.topic, msg.payload, msg.key ?? undefined);
        } else {
          const [exchange, routingKey] = msg.topic.split(':');
          await this.rabbit.publishRaw(exchange, routingKey, msg.payload);
        }
        await this.outbox.markSent(msg.id);
      } catch (err) {
        await this.outbox.markFailed(msg.id, err);
      }
    }
  }
}
