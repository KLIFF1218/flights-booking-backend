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
  ) {}

  @Get()
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.healthIndicator.check('liveness').up()]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.redisHealth.pingCheck('redis'),
      () => this.rabbitmqHealth.pingCheck('rabbitmq'),
    ]);
  }
}
