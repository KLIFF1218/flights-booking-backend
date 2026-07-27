const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'cvv',
  'cardnumber',
]);

const REDACTED = '[REDACTED]';

export function sanitizeForLog<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown) => sanitizeForLog(item)) as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = REDACTED;
      continue;
    }

    sanitized[key] = sanitizeForLog(nestedValue);
  }

  return sanitized as T;
}

export function buildRequestLogContext(
  request: {
    body?: unknown;
    params?: unknown;
    query?: unknown;
    headers?: Record<string, unknown>;
  },
  options: { includeBody?: boolean } = {},
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    params: sanitizeForLog(request.params),
    query: sanitizeForLog(request.query),
  };

  if (options.includeBody && request.body !== undefined) {
    context.body = sanitizeForLog(request.body);
  }

  if (request.headers?.authorization) {
    context.authorization = REDACTED;
  }

  return context;
}
