import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';
import { RedisService } from 'src/infra/redis/redis.service';
import { AuthEmailService } from 'src/modules/auth/services/email/auth-email.service';
import { UsersE2eModule } from './users-e2e.module';
import { MemoryRedisService } from './memory-redis.service';

/**
 * Boots a slim Nest app for users e2e (auth + users + admin-users only).
 */
export async function createE2eApp(): Promise<{
  app: NestExpressApplication;
  module: TestingModule;
}> {
  const module = await Test.createTestingModule({
    imports: [UsersE2eModule],
  })
    .overrideGuard(RateLimitGuard)
    .useValue({ canActivate: async () => true })
    .overrideProvider(RedisService)
    .useClass(MemoryRedisService)
    .overrideProvider(AuthEmailService)
    .useValue({
      sendVerification: async () => undefined,
      sendPasswordReset: async () => undefined,
      buildVerifyUrl: (token: string) => `http://localhost/auth/verify?token=${token}`,
      buildResetUrl: (token: string) => `http://localhost/auth/reset-password?token=${token}`,
    })
    .compile();

  const app = module.createNestApplication<NestExpressApplication>();

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/ready', 'metrics'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  await app.init();

  return { app, module };
}

/** Prefix used by all e2e specs that mirror production routes. */
export const API_V1 = '/api/v1';
