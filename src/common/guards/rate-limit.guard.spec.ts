import { type ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { type RateLimiterService } from '../../infra/rate-limiter/rate-limiter-redis.service';
import { RATE_LIMIT_METADATA, SKIP_RATE_LIMIT_METADATA } from '../decorators/rate-limit.decorator';
import { DEFAULT_RATE_LIMIT } from '../decorators/rate-limit.presets';
import { type MetricsService } from '../../infra/metrics/metrics.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let rateLimiter: { createLimiter: jest.Mock; consume: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  const createContext = (req: { ip?: string; user?: { id: string }; body?: { email?: string } }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  beforeEach(() => {
    rateLimiter = {
      createLimiter: jest.fn().mockReturnValue({}),
      consume: jest.fn().mockResolvedValue(undefined),
    };
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new RateLimitGuard(
      rateLimiter as unknown as RateLimiterService,
      reflector as unknown as Reflector,
      {
        recordRateLimit: jest.fn(),
      } as unknown as MetricsService,
    );
  });

  it('should skip rate limiting when metadata is set', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === SKIP_RATE_LIMIT_METADATA) return true;
      return undefined;
    });

    await expect(guard.canActivate(createContext({ ip: '1.2.3.4' }))).resolves.toBe(true);
    expect(rateLimiter.createLimiter).not.toHaveBeenCalled();
  });

  it('should apply default rate limit when no override is present', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === SKIP_RATE_LIMIT_METADATA) return false;
      if (key === RATE_LIMIT_METADATA) return undefined;
      return undefined;
    });

    await expect(guard.canActivate(createContext({ ip: '1.2.3.4' }))).resolves.toBe(true);

    expect(rateLimiter.createLimiter).toHaveBeenCalledWith(DEFAULT_RATE_LIMIT);
    expect(rateLimiter.consume).toHaveBeenCalledWith({}, 'ip:1.2.3.4');
  });

  it('should use user-based key for authenticated requests', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === SKIP_RATE_LIMIT_METADATA) return false;
      if (key === RATE_LIMIT_METADATA) return { points: 5, duration: 60 };
      return undefined;
    });

    await expect(
      guard.canActivate(createContext({ ip: '1.2.3.4', user: { id: 'user_1' } })),
    ).resolves.toBe(true);

    expect(rateLimiter.consume).toHaveBeenCalledWith({}, 'user:user_1');
  });

  it('should use email-based key for unauthenticated requests with email body', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === SKIP_RATE_LIMIT_METADATA) return false;
      if (key === RATE_LIMIT_METADATA) return { points: 5, duration: 60 };
      return undefined;
    });

    await expect(
      guard.canActivate(createContext({ ip: '1.2.3.4', body: { email: 'User@Example.com' } })),
    ).resolves.toBe(true);

    expect(rateLimiter.consume).toHaveBeenCalledWith({}, 'email:user@example.com');
  });

  it('should throw 429 when rate limit is exceeded', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === SKIP_RATE_LIMIT_METADATA) return false;
      if (key === RATE_LIMIT_METADATA) return undefined;
      return undefined;
    });
    rateLimiter.consume.mockRejectedValue(new Error('rate limit'));

    await expect(guard.canActivate(createContext({ ip: '1.2.3.4' }))).rejects.toEqual(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
    );
  });
});
