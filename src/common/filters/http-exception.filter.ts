import type { ArgumentsHost } from '@nestjs/common';
import { type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { type Response, type Request } from 'express';
import { type Logger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';
import { getTraceId } from '../utils/trace-id';
import { type ErrorResponseDto } from '../dto/error-response.dto';
import { buildRequestLogContext } from '../utils/sanitize-for-log.util';
import { extractHttpErrorBody } from '../utils/extract-http-exception.util';

export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorBody =
      exception instanceof HttpException
        ? extractHttpErrorBody(exception)
        : { error: 'Internal server error', message: 'Internal server error' };

    const resBody: ErrorResponseDto = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      error: errorBody.error,
      message: errorBody.message,
      requestId: request.requestId,
      traceId: getTraceId(),
      errorCode: errorBody.errorCode,
      repriceReason: errorBody.repriceReason,
    };

    const isServerError = status >= 500;

    const logMeta: Record<string, unknown> = {
      ...resBody,
      ...buildRequestLogContext(request, { includeBody: isServerError }),
    };

    if (exception instanceof Error && isServerError) {
      logMeta.stack = exception.stack;
    }

    if (isServerError) {
      this.logger.error(logMeta, 'Server error');
      Sentry.captureException(exception);
    } else {
      this.logger.warn(logMeta, 'Client error');
    }

    response.status(status).json(resBody);
  }
}
