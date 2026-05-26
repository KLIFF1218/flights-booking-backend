import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';
const CSRF_EXCLUDED_PATHS = ['/webhook', '/api/v1'];

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const requestPath = req.path || req.originalUrl || '';

    // Skip CSRF for excluded paths and API routes
    if (CSRF_EXCLUDED_PATHS.some((path) => requestPath.includes(path))) {
      return next();
    }

    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

    if (isSafeMethod) {
      if (!csrfCookie) {
        const token = randomBytes(16).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, token, {
          sameSite: 'lax',
          secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
          httpOnly: false,
        });
      }
      return next();
    }

    const csrfHeader = req.header(CSRF_HEADER_NAME);

    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return next();
  }
}
