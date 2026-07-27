import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';
import { RedisService } from 'src/infra/redis/redis.service';
import { MemoryRedisService } from './memory-redis.service';
import { FlightsE2eModule } from './flights-e2e.module';

export async function createFlightsE2eApp(): Promise<{
  app: NestExpressApplication;
  module: TestingModule;
}> {
  const module = await Test.createTestingModule({
    imports: [FlightsE2eModule],
  })
    .overrideGuard(RateLimitGuard)
    .useValue({ canActivate: async () => true })
    .overrideProvider(RedisService)
    .useClass(MemoryRedisService)
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
