import type { Response } from 'express';
import { IS_DEV_NODE } from 'src/common/utils/is-dev';

/** Clear refresh cookie with the same flags used when it was set. */
export function clearRefreshCookie(res: Response, cookieDomain: string): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: !IS_DEV_NODE,
    sameSite: 'lax',
    path: '/',
    ...(IS_DEV_NODE ? {} : { domain: cookieDomain }),
  });
}
