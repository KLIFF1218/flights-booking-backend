import { type ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import * as Sentry from '@sentry/nestjs';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let logger: { error: jest.Mock; warn: jest.Mock };
  let response: { status: jest.Mock; json: jest.Mock };
  let request: {
    url: string;
    method: string;
    body: Record<string, string>;
    params: Record<string, string>;
    query: Record<string, string>;
    headers: Record<string, string>;
    requestId?: string;
  };

  const createHost = (): ArgumentsHost =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    }) as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      error: jest.fn(),
      warn: jest.fn(),
    };
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    request = {
      url: '/api/v1/auth/login',
      method: 'POST',
      body: { email: 'user@example.com', password: 'Secret123!' },
      params: {},
      query: {},
      headers: { authorization: 'Bearer secret' },
      requestId: 'req_1',
    };

    filter = new HttpExceptionFilter(logger as any);
  });

  it('should log client errors as warn without body or sentry', () => {
    filter.catch(new BadRequestException('Invalid credentials'), createHost());

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        authorization: '[REDACTED]',
      }),
      'Client error',
    );
    expect(logger.warn.mock.calls[0][0]).not.toHaveProperty('body');
    expect(logger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid credentials',
        error: 'Bad Request',
      }),
    );
  });

  it('should log server errors as error with sanitized body and sentry', () => {
    const exception = new Error('Database unavailable');

    filter.catch(exception, createHost());

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          email: 'user@example.com',
          password: '[REDACTED]',
        },
        stack: exception.stack,
      }),
      'Server error',
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
