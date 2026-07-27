import { buildRequestLogContext, sanitizeForLog } from './sanitize-for-log.util';

describe('sanitizeForLog', () => {
  it('should redact sensitive keys', () => {
    expect(
      sanitizeForLog({
        email: 'user@example.com',
        password: 'Secret123!',
        nested: {
          refreshToken: 'token-value',
        },
      }),
    ).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      nested: {
        refreshToken: '[REDACTED]',
      },
    });
  });

  it('should omit body from request context by default', () => {
    expect(
      buildRequestLogContext({
        body: { password: 'Secret123!' },
        params: { id: 'booking_1' },
        query: { page: '1' },
        headers: { authorization: 'Bearer secret' },
      }),
    ).toEqual({
      params: { id: 'booking_1' },
      query: { page: '1' },
      authorization: '[REDACTED]',
    });
  });

  it('should include sanitized body when requested', () => {
    expect(
      buildRequestLogContext(
        {
          body: { email: 'user@example.com', password: 'Secret123!' },
          params: {},
          query: {},
          headers: {},
        },
        { includeBody: true },
      ),
    ).toEqual({
      params: {},
      query: {},
      body: {
        email: 'user@example.com',
        password: '[REDACTED]',
      },
    });
  });
});
