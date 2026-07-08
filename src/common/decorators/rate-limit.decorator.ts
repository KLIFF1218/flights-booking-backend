import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA = Symbol('rate-limit-options');

export interface RateLimitOptions {
  points: number;
  duration: number;
  blockDuration?: number;
  keyPrefix?: string;
}

export const RateLimit = (options: RateLimitOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_METADATA, options);
