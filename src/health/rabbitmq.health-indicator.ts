import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RabbitmqHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const check = this.healthIndicatorService.check(key);

    try {
      const isConnected = this.amqpConnection.managedConnection?.isConnected() ?? false;

      if (!isConnected) {
        return check.down({ message: 'RabbitMQ not connected' });
      }

      return check.up();
    } catch {
      return check.down({ message: 'RabbitMQ ping failed' });
    }
  }
}
