import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '../infra/redis/redis.module';
import { RabbitmqModule } from '../infra/rabbitmq/rabbitmq.module';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health-indicator';
import { RabbitmqHealthIndicator } from './rabbitmq.health-indicator';

@Module({
  imports: [TerminusModule, RedisModule, RabbitmqModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, RabbitmqHealthIndicator],
})
export class HealthModule {}
