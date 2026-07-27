import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../constants/csrf.constants';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const csrfCookie =
      typeof req.cookies?.[CSRF_COOKIE_NAME] === 'string'
        ? req.cookies[CSRF_COOKIE_NAME]
        : undefined;
    const csrfHeader = req.header(CSRF_HEADER_NAME);

    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
