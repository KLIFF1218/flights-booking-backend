import type { ConfigService } from '@nestjs/config';
import { isDev } from '../common/utils';
import * as crypto from 'crypto';
import type { Params } from 'nestjs-pino';

export function getLoggingConfig(config: ConfigService): Params {
  const dev = isDev(config);

  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', 'info'),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'body.password',
          'body.token',
          'body.refreshToken',
          'body.accessToken',
          '*.password',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
        ],
        censor: '[REDACTED]',
      },

      transport: dev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      genReqId: (req) => {
        const request = req as {
          requestId?: string;
          headers: Record<string, string | string[] | undefined>;
        };
        if (request.requestId) {
          return request.requestId;
        }

        const header = request.headers['x-request-id'] ?? request.headers['x-correlation-id'];
        if (typeof header === 'string' && header.length > 0) {
          return header;
        }

        return crypto.randomUUID();
      },

      customProps: (req) => ({
        requestId: (req as { requestId?: string }).requestId ?? req.headers['x-request-id'],
      }),

      autoLogging: false,
    },
  };
}
