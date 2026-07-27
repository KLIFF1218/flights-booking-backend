import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

import { RedisService } from '../infra/redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const check = this.healthIndicatorService.check(key);

    try {
      const response = await this.redisService.getClient().ping();

      if (response !== 'PONG') {
        return check.down({ message: 'Unexpected Redis ping response' });
      }

      return check.up();
    } catch {
      return check.down({ message: 'Redis ping failed' });
    }
  }
}
