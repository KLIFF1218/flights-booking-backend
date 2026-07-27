import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

const redisConfig = (configService: ConfigService): RedisOptions => {
  const password = configService.get<string>('REDIS_PASSWORD');

  return {
    host: configService.getOrThrow<string>('REDIS_HOST'),
    port: configService.getOrThrow<number>('REDIS_PORT'),
    ...(password ? { password } : {}),
  };
};

export { redisConfig };
