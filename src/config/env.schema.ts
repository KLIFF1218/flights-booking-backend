import { z } from 'zod';

const booleanString = z.enum(['true', 'false']);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    HTTP_HOST: z.string().default('0.0.0.0'),
    HTTP_PORT: z.coerce.number().int().min(1).max(65535),
    APP_HOST: z.string().optional(),
    APP_URL: z.string().optional(),
    HTTP_CORS: z.string().min(1, 'HTTP_CORS is required'),
    COOKIES_DOMAIN: z.string().min(1, 'COOKIES_DOMAIN is required'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    REDIS_TLS: booleanString.optional(),

    JWT_SECRET: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    JWT_EXPIRES_ACCESS_TOKEN: z.string().default('15m'),
    JWT_EXPIRES_REFRESH_TOKEN: z.string().default('7d'),

    QUEUE_PREFIX: z.string().min(1).default('dev'),

    RABBITMQ_URI: z.string().min(1, 'RABBITMQ_URI is required'),
    RABBITMQ_EXCHANGE: z.string().min(1, 'RABBITMQ_EXCHANGE is required'),
    RABBITMQ_QUEUE: z.string().min(1, 'RABBITMQ_QUEUE is required'),
    RABBITMQ_DLX: z.string().min(1, 'RABBITMQ_DLX is required'),
    RABBITMQ_CONNECTION_WAIT: booleanString.optional(),

    KAFKA_BROKERS: z.string().default('localhost:9092'),
    KAFKA_CLIENT_ID: z.string().default('max-airline'),
    KAFKA_AUDIT_CONSUMER_GROUP: z.string().default('booking-audit'),
    KAFKA_NOTIFICATIONS_CONSUMER_GROUP: z.string().default('booking-notifications'),
    KAFKA_ANALYTICS_CONSUMER_GROUP: z.string().default('booking-analytics'),
    KAFKA_DOMAIN_TOPICS: z
      .string()
      .default(
        'booking.created,booking.expired,booking.paid,booking.canceled,booking.ticketing.failed,ticket.issued,payment.failed,payment.reconciliation.refunded,flight.delayed,flight.cancelled',
      ),

    S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL'),
    S3_PUBLIC_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
    S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
    S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
    S3_FORCE_PATH_STYLE: booleanString.optional(),

    PAYMENT_PROVIDER_DEFAULT: z.enum(['STRIPE', 'YOOKASSA']).default('STRIPE'),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    YOOKASSA_SHOP_ID: z.string().optional(),
    YOOKASSA_API_KEY: z.string().optional(),
    YOOKASSA_CAPTURE: booleanString.optional(),

    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().optional(),

    SWAGGER_ENABLED: booleanString.default('false'),
    SWAGGER_SERVER: z.string().optional(),

    METRICS_AUTH_TOKEN: z.string().optional(),

    VK_CLIENT_ID: z.string().optional(),
    VK_CLIENT_SECRET: z.string().optional(),
    VK_GRANT_TYPE: z.string().optional(),
    VK_REDIRECT_URI: z.string().optional(),

    SENTRY_DSN: z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const isProduction = env.NODE_ENV === 'production';

    if (isProduction) {
      const access = env.JWT_ACCESS_SECRET?.trim();
      const refresh = env.JWT_REFRESH_SECRET?.trim();

      if (!access) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_ACCESS_SECRET'],
          message: 'JWT_ACCESS_SECRET is required when NODE_ENV=production',
        });
      }

      if (!refresh) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_REFRESH_SECRET is required when NODE_ENV=production',
        });
      }

      if (access && refresh && access === refresh) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production',
        });
      }

      if (env.SWAGGER_ENABLED === 'true') {
        ctx.addIssue({
          code: 'custom',
          path: ['SWAGGER_ENABLED'],
          message: 'SWAGGER_ENABLED must be false in production',
        });
      }

      const metricsToken = env.METRICS_AUTH_TOKEN?.trim();
      if (!metricsToken || metricsToken.length < 16) {
        ctx.addIssue({
          code: 'custom',
          path: ['METRICS_AUTH_TOKEN'],
          message:
            'METRICS_AUTH_TOKEN is required in production (min 16 characters) to protect /metrics',
        });
      }

      if (env.PAYMENT_PROVIDER_DEFAULT === 'STRIPE') {
        if (!env.STRIPE_SECRET_KEY?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['STRIPE_SECRET_KEY'],
            message: 'STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER_DEFAULT=STRIPE',
          });
        }
        if (!env.STRIPE_WEBHOOK_SECRET?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['STRIPE_WEBHOOK_SECRET'],
            message: 'STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER_DEFAULT=STRIPE',
          });
        }
      }

      if (env.PAYMENT_PROVIDER_DEFAULT === 'YOOKASSA') {
        if (!env.YOOKASSA_SHOP_ID?.trim() || !env.YOOKASSA_API_KEY?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['YOOKASSA_SHOP_ID'],
            message:
              'YOOKASSA_SHOP_ID and YOOKASSA_API_KEY are required when PAYMENT_PROVIDER_DEFAULT=YOOKASSA',
          });
        }
      }

      if (!env.RESEND_API_KEY?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required in production for ticket emails',
        });
      }
    } else {
      const legacyJwt = env.JWT_SECRET?.trim();
      const splitJwt = env.JWT_ACCESS_SECRET?.trim() && env.JWT_REFRESH_SECRET?.trim();

      if (!legacyJwt && !splitJwt) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_SECRET'],
          message:
            'Set JWT_SECRET or both JWT_ACCESS_SECRET and JWT_REFRESH_SECRET for non-production',
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function parseEnvConfig(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'env';
        return `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${details}`);
  }

  return result.data;
}
