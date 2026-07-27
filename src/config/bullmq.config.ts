import type { QueueOptions } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import { redisConfig } from './redis.config';

export const getBullmqConfig = (configService: ConfigService): QueueOptions => {
  return {
    connection: {
      maxRetriesPerRequest: 5,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      ...redisConfig(configService),
    },
    prefix: configService.getOrThrow<string>('QUEUE_PREFIX'),
  };
};
