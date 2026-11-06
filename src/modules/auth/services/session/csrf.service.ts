import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { IS_DEV_NODE } from 'src/common/utils/is-dev';
import { CSRF_COOKIE_NAME } from 'src/common/constants/csrf.constants';

@Injectable()
export class CsrfService {
  private readonly cookieDomain: string;

  constructor(private readonly config: ConfigService) {
    this.cookieDomain = config.getOrThrow<string>('COOKIES_DOMAIN');
  }

  issueToken(res: Response): string {
    const token = randomBytes(32).toString('hex');

    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: !IS_DEV_NODE,
      sameSite: 'lax',
      path: '/',
      ...(IS_DEV_NODE ? {} : { domain: this.cookieDomain }),
    });

    return token;
  }
}
