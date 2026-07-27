import { Injectable } from '@nestjs/common';

/**
 * In-memory stand-in for {@link RedisService} used by slim e2e apps
 * that should not require a real Redis process.
 */
@Injectable()
export class MemoryRedisService {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async onModuleInit(): Promise<void> {
    // no-op
  }

  async onModuleDestroy(): Promise<void> {
    this.store.clear();
  }

  getClient(): this {
    return this;
  }

  private isExpired(entry: { expiresAt?: number }): boolean {
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= Date.now();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<'OK'> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
    return 'OK';
  }

  async setIfNotExists<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) {
      return false;
    }
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async delete(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async getDelete<T>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    if (value !== null) {
      await this.delete(key);
    }
    return value;
  }

  async delByPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }
}
