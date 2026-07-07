import { DocumentBuilder } from '@nestjs/swagger';
import type { ConfigService } from '@nestjs/config';

export const getSwaggerConfig = (config?: ConfigService) => {
  const version = process.env.npm_package_version ?? process.env.npm_project_version ?? '1.0.0';

  const builder = new DocumentBuilder()
    .setTitle('MaxAirline API')
    .setDescription(
      'Complete API documentation for MaxAirline — endpoints, DTOs, auth and examples. Generated for resume/demo purposes.',
    )
    .setVersion(version)
    .setContact('MaxAirline API Team', 'https://example.com', 'dev@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearerAuth',
    )
    .addCookieAuth('connect.sid');

  try {
    if (config) {
      const host = config.get<string>('HTTP_HOST') ?? 'localhost';
      const port = config.get<number>('HTTP_PORT') ?? 3000;
      const protocol = config.get<string>('HTTP_TLS') === 'true' ? 'https' : 'http';
      builder.addServer(`${protocol}://${host}:${port}`);
    } else if (process.env.SWAGGER_SERVER) {
      builder.addServer(process.env.SWAGGER_SERVER);
    } else {
      builder.addServer('http://localhost:3000');
    }
  } catch {
    builder.addServer('http://localhost:3000');
  }

  return builder.build();
};
