import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CsrfService } from './csrf.service';
import { CSRF_COOKIE_NAME } from 'src/common/constants/csrf.constants';

describe('CsrfService', () => {
  let service: CsrfService;
  const res = { cookie: jest.fn() } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrfService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('localhost') },
        },
      ],
    }).compile();

    service = module.get(CsrfService);
  });

  it('issues random token and sets cookie', () => {
    const token = service.issueToken(res);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      token,
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });
});
