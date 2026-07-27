import { parseEnvConfig } from './env.schema';

describe('env.schema', () => {
  const baseEnv = {
    NODE_ENV: 'development',
    HTTP_PORT: '3001',
    HTTP_CORS: 'http://localhost',
    COOKIES_DOMAIN: 'localhost',
    DATABASE_URL: 'postgresql://admin:pass@localhost:5433/maxairline',
    REDIS_URL: 'redis://:pass@localhost:6379',
    JWT_SECRET: 'dev-secret',
    RABBITMQ_URI: 'amqp://admin:pass@localhost:5672',
    RABBITMQ_EXCHANGE: 'booking.events',
    RABBITMQ_QUEUE: 'booking.ticketing',
    RABBITMQ_DLX: 'booking.events.dlx',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'my-tickets',
    S3_ACCESS_KEY: 'minio',
    S3_SECRET_KEY: 'minio123',
  };

  it('accepts a minimal development configuration', () => {
    expect(parseEnvConfig(baseEnv).HTTP_PORT).toBe(3001);
  });

  it('requires METRICS_AUTH_TOKEN in production', () => {
    expect(() =>
      parseEnvConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'access-secret-key',
        JWT_REFRESH_SECRET: 'refresh-secret-key',
        SWAGGER_ENABLED: 'false',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        RESEND_API_KEY: 're_test',
      }),
    ).toThrow(/METRICS_AUTH_TOKEN/);
  });

  it('rejects Swagger in production', () => {
    expect(() =>
      parseEnvConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'access-secret-key',
        JWT_REFRESH_SECRET: 'refresh-secret-key',
        SWAGGER_ENABLED: 'true',
        METRICS_AUTH_TOKEN: 'metrics-token-16chars',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        RESEND_API_KEY: 're_test',
      }),
    ).toThrow(/SWAGGER_ENABLED/);
  });
});
