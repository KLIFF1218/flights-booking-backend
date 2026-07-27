import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../constants/csrf.constants';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  function context(cookies: Record<string, string>, header?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          cookies,
          header: (name: string) => (name === CSRF_HEADER_NAME ? header : undefined),
        }),
      }),
    } as any;
  }

  it('allows matching cookie and header', () => {
    expect(guard.canActivate(context({ [CSRF_COOKIE_NAME]: 'abc' }, 'abc'))).toBe(true);
  });

  it('rejects missing or mismatched tokens', () => {
    expect(() => guard.canActivate(context({}, 'abc'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({ [CSRF_COOKIE_NAME]: 'abc' }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context({ [CSRF_COOKIE_NAME]: 'abc' }, 'xyz'))).toThrow(
      ForbiddenException,
    );
  });
});
