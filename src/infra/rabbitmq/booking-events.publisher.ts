import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class BookingEventsPublisher {
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.exchange = this.config.getOrThrow<string>('RABBITMQ_EXCHANGE');
  }

  async publishBookingPaid(bookingId: string): Promise<void> {
    await this.publishRaw(this.exchange, 'booking.paid', {
      bookingId,
      occurredAt: new Date().toISOString(),
    });
  }

  async publishBookingCanceled(bookingId: string): Promise<void> {
    await this.publishRaw(this.exchange, 'booking.canceled', {
      bookingId,
      occurredAt: new Date().toISOString(),
    });
  }

  async publishRaw<T>(exchange: string, routingKey: string, payload: T): Promise<void> {
    try {
      await this.amqpConnection.publish(exchange, routingKey, payload);
      runSafely(() => this.metrics.recordRabbitPublish(routingKey, 'success'));
    } catch (error) {
      runSafely(() => this.metrics.recordRabbitPublish(routingKey, 'failure'));
      throw error;
    }
  }
}
