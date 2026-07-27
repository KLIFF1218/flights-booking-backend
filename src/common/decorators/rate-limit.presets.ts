import { type RateLimitOptions } from './rate-limit.decorator';

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  points: 120,
  duration: 60,
  keyPrefix: 'rl:default',
};

export const RATE_LIMIT_PRESETS = {
  flightSearch: {
    points: 15,
    duration: 60,
    keyPrefix: 'rl:flights-search',
  },
  flightSearchPage: {
    points: 60,
    duration: 60,
    keyPrefix: 'rl:flights-search-page',
  },
  airportsSearch: {
    points: 30,
    duration: 60,
    keyPrefix: 'rl:airports-search',
  },
  flightPricing: {
    points: 30,
    duration: 60,
    keyPrefix: 'rl:flight-pricing',
  },
  authLogin: {
    points: 10,
    duration: 60,
    keyPrefix: 'rl:auth-login',
  },
  authRegister: {
    points: 5,
    duration: 60,
    keyPrefix: 'rl:auth-register',
  },
  authRefresh: {
    points: 20,
    duration: 60,
    keyPrefix: 'rl:auth-refresh',
  },
  authVk: {
    points: 10,
    duration: 60,
    keyPrefix: 'rl:auth-vk',
  },
  authVerify: {
    points: 5,
    duration: 60,
    keyPrefix: 'rl:auth-verify',
  },
  authForgotPassword: {
    points: 5,
    duration: 60,
    keyPrefix: 'rl:auth-forgot',
  },
  authResetPassword: {
    points: 5,
    duration: 60,
    keyPrefix: 'rl:auth-reset',
  },
  webhook: {
    points: 20,
    duration: 60,
    keyPrefix: 'rl:webhook',
  },
} as const satisfies Record<string, RateLimitOptions>;
