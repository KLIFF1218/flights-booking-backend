import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RateLimiterService } from '../../infra/rate-limiter/rate-limiter-redis.service';
import {
  RATE_LIMIT_METADATA,
  SKIP_RATE_LIMIT_METADATA,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { DEFAULT_RATE_LIMIT } from '../decorators/rate-limit.presets';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { User } from '@prisma/client';
import { MetricsService } from '../../infra/metrics/metrics.service';
import { runSafely } from '../utils/safe-metrics.util';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly reflector: Reflector,
    private readonly metrics: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipRateLimit) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: User }>();

    const rateLimitOptions =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;

    const limiter = this.rateLimiter.createLimiter(rateLimitOptions);

    const key = this.resolveRateLimitKey(req);

    try {
      await this.rateLimiter.consume(limiter, key);
      runSafely(() =>
        this.metrics.recordRateLimit(rateLimitOptions.keyPrefix ?? 'rl:default', 'allowed'),
      );
      return true;
    } catch {
      runSafely(() =>
        this.metrics.recordRateLimit(rateLimitOptions.keyPrefix ?? 'rl:default', 'blocked'),
      );
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private resolveRateLimitKey(req: Request & { user?: User }): string {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email) {
      return `email:${email}`;
    }

    return `ip:${req.ip}`;
  }
}
