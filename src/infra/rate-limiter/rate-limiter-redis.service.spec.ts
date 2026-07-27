import { Test, type TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter-redis.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { type RateLimitOptions } from 'src/common/decorators/rate-limit.decorator';
import { RateLimiterRedis } from 'rate-limiter-flexible';

jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn().mockImplementation((opts) => ({
      opts,
      consume: jest.fn(),
    })),
  };
});

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let redisService: any;

  beforeEach(async () => {
    redisService = {
      getClient: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimiterService, { provide: RedisService, useValue: redisService }],
    }).compile();

    service = module.get(RateLimiterService);
  });

  describe('createLimiter', () => {
    it('should create RateLimiterRedis with correct parameters', () => {
      const options: RateLimitOptions = { points: 5, duration: 10 };

      const limiter = service.createLimiter(options);

      expect(RateLimiterRedis).toHaveBeenCalledTimes(1);

      expect(RateLimiterRedis).toHaveBeenCalledWith({
        storeClient: redisService.getClient(),
        keyPrefix: 'rl',
        points: 5,
        duration: 10,
        blockDuration: 10,
      });

      expect(limiter.opts.points).toBe(5);
      expect(limiter.opts.duration).toBe(10);
    });
  });

  describe('consume', () => {
    it('should call limiter.consume with the correct key', async () => {
      const limiter = service.createLimiter({ points: 5, duration: 10 });

      await service.consume(limiter as any, 'user:1');

      expect(limiter.consume).toHaveBeenCalledWith('user:1');
    });

    it('should rethrow errors (when rate limit is exceeded)', async () => {
      const limiter = service.createLimiter({ points: 1, duration: 1 });

      (limiter.consume as jest.Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(service.consume(limiter as any, 'user:1')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });
  });
});
