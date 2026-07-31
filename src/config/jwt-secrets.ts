import type { ConfigService } from '@nestjs/config';

export function getJwtAccessSecret(config: ConfigService): string {
  return config.get<string>('JWT_ACCESS_SECRET') ?? config.getOrThrow<string>('JWT_SECRET');
}

export function getJwtRefreshSecret(config: ConfigService): string {
  return config.get<string>('JWT_REFRESH_SECRET') ?? config.getOrThrow<string>('JWT_SECRET');
}
