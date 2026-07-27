import { config as loadEnv } from 'dotenv';
import * as Sentry from '@sentry/nestjs';

try {
  loadEnv();
} catch {
  // dotenv is optional when env vars are injected by the runtime.
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === 'true',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    debug: process.env.SENTRY_DEBUG === 'true',
  });
}
