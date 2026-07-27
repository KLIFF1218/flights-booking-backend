import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';

import { PrismaService } from '../infra/db/prisma/prisma.service';
import { RedisHealthIndicator } from './redis.health-indicator';
import { RabbitmqHealthIndicator } from './rabbitmq.health-indicator';
import { SkipRateLimit } from '../common/decorators';
import { MetricsService } from '../infra/metrics/metrics.service';
import { runSafely } from '../common/utils/safe-metrics.util';

@ApiExcludeController()
@SkipRateLimit()
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly rabbitmqHealth: RabbitmqHealthIndicator,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  @HealthCheck()
  liveness() {
    runSafely(() => this.metrics.setHealthUp('liveness', true));
    return this.health.check([() => this.healthIndicator.check('liveness').up()]);
  }

  @Get('ready')
  @HealthCheck()
  async readiness() {
    try {
      const result = await this.health.check([
        () => this.prismaHealth.pingCheck('database', this.prisma),
        () => this.redisHealth.pingCheck('redis'),
        () => this.rabbitmqHealth.pingCheck('rabbitmq'),
      ]);

      runSafely(() => {
        this.metrics.setHealthUp('database', result.details?.database?.status === 'up');
        this.metrics.setHealthUp('redis', result.details?.redis?.status === 'up');
        this.metrics.setHealthUp('rabbitmq', result.details?.rabbitmq?.status === 'up');
        this.metrics.setHealthUp('readiness', result.status === 'ok');
      });

      return result;
    } catch (error) {
      runSafely(() => {
        this.metrics.setHealthUp('database', false);
        this.metrics.setHealthUp('redis', false);
        this.metrics.setHealthUp('rabbitmq', false);
        this.metrics.setHealthUp('readiness', false);
      });
      throw error;
    }
  }
}
