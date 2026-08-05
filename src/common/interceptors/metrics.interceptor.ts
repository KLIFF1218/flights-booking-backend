import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Counter, Histogram, register } from 'prom-client';
import type { Request, Response } from 'express';
import { HttpException } from '@nestjs/common';

const INTERNAL_ROUTES = new Set(['/metrics', '/health', '/health/ready']);

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly httpRequestCounter: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly httpErrorCounter: Counter;

  constructor() {
    this.httpRequestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register],
    });

    this.httpErrorCounter = new Counter({
      name: 'http_errors_total',
      help: 'Total HTTP errors',
      labelNames: ['method', 'route', 'status'],
      registers: [register],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { method } = request;
    const route = this.resolveRoute(request);

    if (INTERNAL_ROUTES.has(route)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const status = response.statusCode;

        this.httpRequestCounter.labels(method, route, String(status)).inc();
        this.httpRequestDuration.labels(method, route).observe(duration);
      }),
      catchError((error: unknown) => {
        const duration = (Date.now() - startTime) / 1000;
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : typeof error === 'object' &&
                error !== null &&
                'status' in error &&
                typeof (error as { status?: unknown }).status === 'number'
              ? (error as { status: number }).status
              : 500;

        this.httpRequestCounter.labels(method, route, String(status)).inc();
        this.httpErrorCounter.labels(method, route, String(status)).inc();
        this.httpRequestDuration.labels(method, route).observe(duration);

        if (error instanceof Error) {
          throw error;
        }

        throw new Error(typeof error === 'string' ? error : 'Request failed');
      }),
    );
  }

  private resolveRoute(request: Request): string {
    const expressRoute = (request.route as { path?: string } | undefined)?.path;

    if (typeof expressRoute === 'string') {
      const baseUrl = request.baseUrl ?? '';
      const route = `${baseUrl}${expressRoute}`.replace(/\/+/g, '/');
      return route || '/';
    }

    return '404_not_found';
  }
}
