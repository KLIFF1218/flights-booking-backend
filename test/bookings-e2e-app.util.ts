import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';
import { RedisService } from 'src/infra/redis/redis.service';
import { AuthEmailService } from 'src/modules/auth/services/email/auth-email.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { MemoryRedisService } from './memory-redis.service';
import { BookingsE2eModule } from './bookings-e2e.module';

export async function createBookingsE2eApp(): Promise<{
  app: NestExpressApplication;
  module: TestingModule;
}> {
  const module = await Test.createTestingModule({
    imports: [BookingsE2eModule],
  })
    .overrideGuard(RateLimitGuard)
    .useValue({ canActivate: async () => true })
    .overrideProvider(RedisService)
    .useClass(MemoryRedisService)
    .overrideProvider(AuthEmailService)
    .useValue({
      sendVerification: async () => undefined,
      sendPasswordReset: async () => undefined,
    })
    .overrideProvider(S3Service)
    .useValue({
      getSignedUrl: async () => 'https://s3.test/ticket.pdf',
      upload: async () => undefined,
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
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  await app.init();

  return { app, module };
}

export const API_V1 = '/api/v1';
