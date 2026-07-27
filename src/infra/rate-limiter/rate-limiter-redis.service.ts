import { Injectable } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { RedisService } from 'src/infra/redis/redis.service';
import { RateLimitOptions } from 'src/common/decorators/rate-limit.decorator';

@Injectable()
export class RateLimiterService {
  constructor(private readonly redisService: RedisService) {}

  private readonly limiters = new Map<string, RateLimiterRedis>();

  createLimiter(options: RateLimitOptions): RateLimiterRedis {
    const cacheKey = JSON.stringify(options);

    const existingLimiter = this.limiters.get(cacheKey);
    if (existingLimiter) {
      return existingLimiter;
    }

    const limiter = new RateLimiterRedis({
      storeClient: this.redisService.getClient(),
      keyPrefix: options.keyPrefix ?? 'rl',
      points: options.points,
      duration: options.duration,
      blockDuration: options.blockDuration ?? 10,
    });

    this.limiters.set(cacheKey, limiter);

    return limiter;
  }

  async consume(limiter: RateLimiterRedis, key: string): Promise<void> {
    await limiter.consume(key);
  }
}
