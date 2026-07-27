import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConfig } from 'src/config/redis.config';
import { Logger } from 'nestjs-pino';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}
  private client!: Redis;

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to Redis...');
    this.client = new Redis({
      ...redisConfig(this.configService),

      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: null,

      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 3000);
        this.logger.warn(`Redis reconnect attempt #${times}, delay ${delay}ms`);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error({ err }, 'Redis connection error');
    });

    await this.client.connect();
  }

  getClient(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<'OK'> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      return await this.client.set(key, serializedValue, 'EX', ttl);
    } else {
      return await this.client.set(key, serializedValue);
    }
  }

  async setIfNotExists<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    const serializedValue = JSON.stringify(value);
    const result = await this.client.set(key, serializedValue, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /** Atomically read and delete a JSON value (Redis GETDEL). */
  async getDelete<T>(key: string): Promise<T | null> {
    const data = await this.client.getdel(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async delByPrefix(prefix: string): Promise<number> {
    const pattern = `${prefix}*`;
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.client.unlink(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async delete(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;

    this.logger.log('Closing Redis connection');

    await this.client.quit();

    this.logger.log('Redis connection closed');
  }
}
