export type HttpErrorBody = {
  error: string | Record<string, unknown>;
  message?: string | string[] | Record<string, unknown>;
  errorCode?: string;
  repriceReason?: string;
};

export function extractHttpErrorBody(exception: {
  getResponse(): string | object;
  message: string;
}): HttpErrorBody {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return {
      error: response,
      message: response,
    };
  }

  if (typeof response === 'object' && response !== null) {
    const body = response as Record<string, unknown>;
    const rawMessage = body.message;
    const rawError = body.error ?? exception.message;
    const errorCode = typeof body.errorCode === 'string' ? body.errorCode : undefined;
    const repriceReason =
      typeof body.repriceReason === 'string' ? body.repriceReason : errorCode;

    const message =
      typeof rawMessage === 'string' ||
      Array.isArray(rawMessage) ||
      (typeof rawMessage === 'object' && rawMessage !== null)
        ? (rawMessage as string | string[] | Record<string, unknown>)
        : undefined;

    return {
      error:
        typeof rawError === 'string'
          ? rawError
          : typeof rawError === 'object' && rawError !== null
            ? (rawError as Record<string, unknown>)
            : exception.message,
      message,
      errorCode,
      repriceReason,
    };
  }

  return {
    error: exception.message,
    message: exception.message,
  };
}
