import { Module } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter-redis.service';
import { RedisModule } from 'src/infra/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [RateLimiterService],
  exports: [RateLimiterService],
})
export class RateLimiterModule {}
