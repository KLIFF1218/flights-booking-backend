import type { ArgumentsHost } from '@nestjs/common';
import { ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { Logger } from 'nestjs-pino';
import { getTraceId } from '../utils/trace-id';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { SentryExceptionCaptured } from '@sentry/nestjs';

export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const resBody: ErrorResponseDto = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      error:
        exception instanceof HttpException
          ? (exception.getResponse() as any) || exception.message
          : 'Internal server error',
      requestId: request.requestId,
      traceId: getTraceId(),
    };

    const logMeta: any = {
      ...resBody,
      body: request.body,
      params: request.params,
      query: request.query,
    };

    if (exception instanceof Error) {
      logMeta.stack = exception.stack;
    }

    this.logger.error(logMeta, 'Unhandled exception');

    response.status(status).json(resBody);
  }
}
