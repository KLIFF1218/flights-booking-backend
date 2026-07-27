export interface IntegrationInfraEnv {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  rabbitmqUri: string;
  s3Endpoint: string;
}

export function applyIntegrationTestEnv(infra: IntegrationInfraEnv): void {
  Object.assign(process.env, {
    NODE_ENV: 'development',
    LOG_LEVEL: 'warn',
    DATABASE_URL: infra.databaseUrl,
    POSTGRES_HOST: 'localhost',
    REDIS_HOST: infra.redisHost,
    REDIS_PORT: String(infra.redisPort),
    REDIS_PASSWORD: infra.redisPassword,
    REDIS_URL: `redis://:${infra.redisPassword}@${infra.redisHost}:${infra.redisPort}`,
    REDIS_TLS: 'false',
    RABBITMQ_URI: infra.rabbitmqUri,
    RABBITMQ_EXCHANGE: 'booking.events',
    RABBITMQ_QUEUE: 'booking.ticketing',
    RABBITMQ_DLX: 'booking.events.dlx',
    RABBITMQ_USER: 'admin',
    RABBITMQ_PASSWORD: 'admin',
    S3_ENDPOINT: infra.s3Endpoint,
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'my-tickets',
    S3_ACCESS_KEY: 'minio',
    S3_SECRET_KEY: 'minio123',
    S3_FORCE_PATH_STYLE: 'true',
    MAILEXAM_HOST: 'sandbox.smtp.mailtrap.io',
    MAILEXAM_PORT: '2525',
    MAILEXAM_LOGIN: 'integration-test',
    MAILEXAM_PASSWORD: 'integration-test',
    MAIL_FROM: 'integration@test.example',
    JWT_SECRET: 'integration-test-jwt-secret',
    JWT_EXPIRES_ACCESS_TOKEN: '15m',
    JWT_EXPIRES_REFRESH_TOKEN: '7d',
    COOKIES_DOMAIN: 'localhost',
    HTTP_CORS: 'http://localhost:3111',
    QUEUE_PREFIX: 'integration-test',
    HTTP_PORT: '3001',
    HTTP_HOST: '0.0.0.0',
    VK_CLIENT_ID: 'integration-test',
    VK_CLIENT_SECRET: 'integration-test',
    VK_GRANT_TYPE: 'authorization_code',
    VK_REDIRECT_URI: 'http://localhost:3111',
    APP_URL: 'http://localhost:3111',
    PAYMENT_PROVIDER_DEFAULT: 'STRIPE',
    SWAGGER_ENABLED: 'false',
  });
}
