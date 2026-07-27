/**
 * Boots Nest long enough to emit swagger.json, then exits.
 * Usage: pnpm exec ts-node -r tsconfig-paths/register scripts/generate-swagger.ts
 */
import '../src/instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { AppModule } from '../src/app.module';
import { getSwaggerConfig } from '../src/config/swagger.config';

async function main(): Promise<void> {
  process.env.SWAGGER_ENABLED = 'true';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/ready', 'metrics'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const config = app.get(ConfigService);
  const document = SwaggerModule.createDocument(app, getSwaggerConfig(config));
  const outPath = path.join(process.cwd(), 'swagger.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf8');

  const authPaths = Object.keys(document.paths ?? {}).filter((p) => p.includes('/auth'));
  console.log(`Wrote ${outPath}`);
  console.log(`Auth paths (${authPaths.length}):`);
  for (const p of authPaths.sort()) {
    console.log(`  ${p}`);
  }

  // Exit before slow infra teardown — swagger file is already on disk.
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
