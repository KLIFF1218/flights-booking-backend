import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '../infra/redis/redis.module';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health-indicator';
import { TestMetricsController } from './test-metrics.controller';

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController, TestMetricsController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
