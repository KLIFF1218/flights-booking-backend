import {
  Inject,
  Injectable,
  Scope,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';

const DEFAULT_VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
};

const YOOKASSA_WEBHOOK_VALIDATION_OPTIONS: ValidationPipeOptions = {
  ...DEFAULT_VALIDATION_OPTIONS,
  forbidNonWhitelisted: false,
};

export function isYookassaWebhookRequest(
  request: Pick<Request, 'method' | 'path' | 'url'>,
): boolean {
  if (request.method !== 'POST') {
    return false;
  }

  const path = request.path ?? request.url ?? '';
  return path.includes('/webhook/yookassa');
}

/**
 * Request-scoped global validation. YooKassa webhooks allow extra PSP fields.
 * Route-level @UsePipes does not replace the global pipe — both run in sequence.
 */
@Injectable({ scope: Scope.REQUEST })
export class AppValidationPipe extends ValidationPipe {
  constructor(@Inject(REQUEST) request: Request) {
    super(
      isYookassaWebhookRequest(request)
        ? YOOKASSA_WEBHOOK_VALIDATION_OPTIONS
        : DEFAULT_VALIDATION_OPTIONS,
    );
  }
}
