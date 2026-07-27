import { type HealthIndicatorService } from '@nestjs/terminus';
import { type AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitmqHealthIndicator } from './rabbitmq.health-indicator';

describe('RabbitmqHealthIndicator', () => {
  const healthIndicatorService = {
    check: jest.fn((key: string) => ({
      up: () => ({ [key]: { status: 'up' } }),
      down: (details?: Record<string, unknown>) => ({
        [key]: { status: 'down', ...details },
      }),
    })),
  };

  it('reports up when RabbitMQ connection is active', async () => {
    const amqpConnection = {
      managedConnection: {
        isConnected: () => true,
      },
    } as unknown as AmqpConnection;

    const indicator = new RabbitmqHealthIndicator(
      healthIndicatorService as unknown as HealthIndicatorService,
      amqpConnection,
    );

    const result = await indicator.pingCheck('rabbitmq');
    expect(result).toEqual({ rabbitmq: { status: 'up' } });
  });

  it('reports down when RabbitMQ connection is missing', async () => {
    const amqpConnection = {
      managedConnection: undefined,
    } as unknown as AmqpConnection;

    const indicator = new RabbitmqHealthIndicator(
      healthIndicatorService as unknown as HealthIndicatorService,
      amqpConnection,
    );

    const result = await indicator.pingCheck('rabbitmq');
    expect(result).toEqual({
      rabbitmq: { status: 'down', message: 'RabbitMQ not connected' },
    });
  });
});
