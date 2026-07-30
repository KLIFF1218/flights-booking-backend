import './instrument';

import { NestFactory } from '@nestjs/core';
import dns from 'dns';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger as NestLogger, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { startTelemetry, shutdownTelemetry } from './telemetry';

import { getCorsConfig } from './config/cors.config';
import { getSwaggerConfig } from './config/swagger.config';
import { assertJwtSecretsForProduction } from './config/jwt-secrets';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';

function writeSwaggerJsonFile(logger: Logger, document: OpenAPIObject): void {
  const outPath = path.join(process.cwd(), 'swagger.json');

  try {
    fs.writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf8');
    logger.log({ path: outPath }, 'Wrote Swagger JSON to disk');
  } catch (writeErr) {
    logger.warn(
      { err: writeErr instanceof Error ? writeErr : String(writeErr) },
      'Could not write swagger.json; Swagger UI at /docs is still available',
    );
  }
}

function mountSwaggerDocsRedirects(app: NestExpressApplication): void {
  const httpAdapter = app.getHttpAdapter();

  for (const legacyPath of ['/api/docs', '/api/v1/docs']) {
    httpAdapter.get(legacyPath, (_req, res: Response) => {
      res.redirect(302, '/docs');
    });
  }
}

startTelemetry();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.use(requestIdMiddleware);

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/ready', 'metrics'],
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(ConfigService);
  assertJwtSecretsForProduction(config);

  const port = config.getOrThrow<number>('HTTP_PORT');
  const host = config.get<string>('HTTP_HOST', '0.0.0.0');
  const env = config.getOrThrow<string>('NODE_ENV');

  dns.setDefaultResultOrder('ipv4first');

  app.set('trust proxy', 1);
  app.use(
    env === 'development'
      ? helmet({
          contentSecurityPolicy: {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              'script-src': ["'self'", "'unsafe-inline'"],
              'style-src': ["'self'", "'unsafe-inline'"],
            },
          },
        })
      : helmet(),
  );

  app.use(cookieParser());

  app.enableCors(getCorsConfig(config));

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  if (config.get('SWAGGER_ENABLED') === 'true') {
    const swaggerConfig = getSwaggerConfig(config);

    try {
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      writeSwaggerJsonFile(logger, document);

      SwaggerModule.setup('docs', app, document, {
        jsonDocumentUrl: 'openapi.json',
        swaggerOptions: {
          persistAuthorization: true,
        },
      });

      mountSwaggerDocsRedirects(app);

      logger.log(
        { url: `http://localhost:${port}/docs` },
        'Swagger UI enabled at /docs (legacy /api/docs redirects here)',
      );
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err : String(err) },
        'Failed to initialize Swagger',
      );
    }
  }

  app.enableShutdownHooks();

  const httpServer = app.getHttpAdapter().getHttpServer() as Server;
  httpServer.on('close', () => {
    void shutdownTelemetry();
  });

  await app.listen(port, host);

  logger.log(
    {
      port,
      host,
      env,
    },
    'HTTP server started',
  );
}

bootstrap().catch((error) => {
  NestLogger.error('Fatal bootstrap error', error);
  process.exit(1);
});
