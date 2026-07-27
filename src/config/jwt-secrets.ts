import type { ConfigService } from '@nestjs/config';

export function getJwtAccessSecret(config: ConfigService): string {
  return config.get<string>('JWT_ACCESS_SECRET') ?? config.getOrThrow<string>('JWT_SECRET');
}

export function getJwtRefreshSecret(config: ConfigService): string {
  return config.get<string>('JWT_REFRESH_SECRET') ?? config.getOrThrow<string>('JWT_SECRET');
}

export function assertJwtSecretsForProduction(config: ConfigService): void {
  if (config.get<string>('NODE_ENV') !== 'production') {
    return;
  }

  const access = config.get<string>('JWT_ACCESS_SECRET');
  const refresh = config.get<string>('JWT_REFRESH_SECRET');

  if (!access?.trim() || !refresh?.trim()) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required when NODE_ENV=production',
    );
  }

  if (access === refresh) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
  }
}
