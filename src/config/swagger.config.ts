import { DocumentBuilder } from '@nestjs/swagger';
import type { ConfigService } from '@nestjs/config';
import { SWAGGER_BEARER_AUTH, SWAGGER_REFRESH_COOKIE_AUTH } from './swagger-auth';

const resolveSwaggerServer = (config?: ConfigService): string => {
  if (process.env.SWAGGER_SERVER) {
    return process.env.SWAGGER_SERVER.replace(/\/$/, '');
  }

  if (config) {
    const port = config.get<number>('HTTP_PORT') ?? 3001;
    const appHost = config.get<string>('APP_HOST')?.replace(/\/$/, '');

    if (appHost) {
      try {
        const url = new URL(appHost);
        if (!url.port) {
          url.port = String(port);
        }
        return url.toString().replace(/\/$/, '');
      } catch {
        return appHost;
      }
    }

    return `http://localhost:${port}`;
  }

  return 'http://localhost:3001';
};

export const getSwaggerConfig = (config?: ConfigService) => {
  const version = process.env.npm_package_version ?? process.env.npm_project_version ?? '1.0.0';

  const serverUrl = resolveSwaggerServer(config);

  const builder = new DocumentBuilder()
    .setTitle('MaxAirline API')
    .setDescription(
      [
        'REST API for MaxAirline flight search, booking, payments, and auth.',
        '',
        '**Auth model:** access JWT in `Authorization: Bearer` (payload `typ: access`);',
        'refresh JWT in HttpOnly cookie `refreshToken` (`typ: refresh`).',
        'Cookie-authenticated mutations also require header `x-xsrf-token` matching the `XSRF-TOKEN` cookie.',
        '',
        'Generated for resume/demo — enable with `SWAGGER_ENABLED=true`.',
      ].join('\n'),
    )
    .setVersion(version)
    .setContact('MaxAirline', 'https://github.com/kliff1218/max-airline', 'dev@maxairline.local')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token from /auth/login, /auth/register, /auth/refresh, or /auth/vk/exchange',
      },
      SWAGGER_BEARER_AUTH,
    )
    .addCookieAuth(
      SWAGGER_REFRESH_COOKIE_AUTH,
      {
        type: 'apiKey',
        in: 'cookie',
        name: SWAGGER_REFRESH_COOKIE_AUTH,
        description:
          'HttpOnly refresh token cookie set by login/register/VK/refresh. Required for /auth/refresh and session logout routes.',
      },
      SWAGGER_REFRESH_COOKIE_AUTH,
    )
    .addServer(serverUrl, 'Primary API server');

  if (serverUrl !== 'http://localhost:3001') {
    builder.addServer('http://localhost:3001', 'Local default');
  }

  return builder.build();
};
