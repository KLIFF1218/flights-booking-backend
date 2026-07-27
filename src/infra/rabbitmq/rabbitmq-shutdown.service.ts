import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Logger } from 'nestjs-pino';

@Injectable()
export class RabbitmqShutdownService implements OnApplicationShutdown {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly logger: Logger,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log({ signal }, 'Closing RabbitMQ connection');

    try {
      await this.amqpConnection.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error: unknown) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error) },
        'RabbitMQ connection close failed or already closed',
      );
    }
  }
}
