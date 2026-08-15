import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { UsersService } from 'src/modules/users/services/users.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { TokenService } from './token.service';
import { RefreshService } from './refresh.service';
import { SocialService } from './social.service';
import { CsrfService } from './csrf.service';
import { PasswordService } from './password.service';
import { EmailVerificationService } from './email-verification.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let tokenService: any;
  let refreshService: any;
  let socialService: any;
  let metrics: any;

  let req: any;
  let res: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    tokenService = {
      issueTokens: jest.fn(),
      clearRefreshCookie: jest.fn(),
      revokeRefreshSession: jest.fn().mockResolvedValue(undefined),
    };

    refreshService = {
      refresh: jest.fn(),
    };

    socialService = {
      vkExchange: jest.fn(),
    };

    metrics = {
      recordLogin: jest.fn(),
      recordLoginFailure: jest.fn(),
    };

    req = {
      headers: { 'user-agent': 'test-agent' },
      ip: '1.1.1.1',
      cookies: {},
      user: { id: 'user-1' },
    };

    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_EXPIRES_ACCESS_TOKEN') return '1h';
              if (key === 'JWT_EXPIRES_REFRESH_TOKEN') return '30d';
              if (key === 'COOKIES_DOMAIN') return 'localhost';
              if (key === 'VK_CLIENT_ID') return 'vk-client-id';
              if (key === 'VK_CLIENT_SECRET') return 'vk-client-secret';
              if (key === 'VK_REDIRECT_URI') return 'https://example.com/callback';
              if (key === 'VK_GRANT_TYPE') return 'authorization_code';
              return undefined;
            }),
          },
        },
        { provide: Logger, useValue: { setContext: jest.fn(), log: jest.fn(), error: jest.fn() } },
        { provide: UsersService, useValue: { getById: jest.fn() } },
        { provide: MetricsService, useValue: metrics },
        { provide: TokenService, useValue: tokenService },
        { provide: RefreshService, useValue: refreshService },
        { provide: SocialService, useValue: socialService },
        {
          provide: CsrfService,
          useValue: { issueToken: jest.fn().mockReturnValue('csrf-token') },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashed-password'),
            verify: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: { sendForUserSafe: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(
        service.register(
          { email: 'a@a.com', password: '12345678', firstName: 'Max', lastName: 'Test' },
          req,
          res,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        status: UserStatus.ACTIVE,
      });
      tokenService.issueTokens.mockResolvedValue({
        accessToken: 'a',
        accessMaxAge: 1000,
        csrfToken: 'csrf',
      });
      const emailVerification = (service as any).emailVerification as {
        sendForUserSafe: jest.Mock;
      };

      const result = await service.register(
        { email: 'a@a.com', password: '12345678', firstName: 'Max', lastName: 'Test' },
        req,
        res,
      );

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'a@a.com',
          password: 'hashed-password',
          firstName: 'Max',
          lastName: 'Test',
          currency: 'USD',
        }),
      });
      expect(emailVerification.sendForUserSafe).toHaveBeenCalledWith('1', undefined);
      expect(tokenService.issueTokens).toHaveBeenCalledWith(
        { id: '1', email: 'a@a.com', status: UserStatus.ACTIVE },
        req,
        res,
      );
      expect(metrics.recordLogin).toHaveBeenCalledWith('register');
      expect(result).toEqual({
        accessToken: 'a',
        accessMaxAge: 1000,
        csrfToken: 'csrf',
        verificationEmailSent: true,
      });
    });

    it('applies locale currency and country on register', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '2',
        email: 'ru@a.com',
        status: UserStatus.ACTIVE,
      });
      tokenService.issueTokens.mockResolvedValue({ accessToken: 'a', accessMaxAge: 1000 });

      await service.register(
        {
          email: 'ru@a.com',
          password: '12345678',
          firstName: 'Max',
          lastName: 'Test',
          locale: 'ru',
        },
        req,
        res,
      );

      const emailVerification = (service as any).emailVerification as {
        sendForUserSafe: jest.Mock;
      };
      expect(emailVerification.sendForUserSafe).toHaveBeenCalledWith('2', 'ru');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'RUB',
          country: 'Russia',
        }),
      });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'a@a.com', password: '12345678' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(metrics.recordLoginFailure).toHaveBeenCalledWith('password', 'no_password');
    });

    it('throws UnauthorizedException when user is blocked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hash',
        status: UserStatus.BLOCKED,
      });

      await expect(
        service.login({ email: 'a@a.com', password: '12345678' }, req, res),
      ).rejects.toThrow('Invalid login or password');
      expect(metrics.recordLoginFailure).toHaveBeenCalledWith('password', 'blocked');
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hash',
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.login({ email: 'a@a.com', password: '12345678' }, req, res),
      ).rejects.toThrow('Invalid login or password');
      expect(metrics.recordLoginFailure).toHaveBeenCalledWith('password', 'blocked');
    });

    it('treats vk-only account without password as invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: null,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.login({ email: 'vk@a.com', password: '12345678' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(metrics.recordLoginFailure).toHaveBeenCalledWith('password', 'no_password');
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        password: 'hash',
        status: UserStatus.ACTIVE,
      });
      const passwords = (service as any).passwords as { verify: jest.Mock };
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@a.com', password: '12345678' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
      expect(metrics.recordLoginFailure).toHaveBeenCalledWith('password', 'invalid_credentials');
    });

    it('logs in and issues tokens', async () => {
      const user = { id: '1', password: 'hash', status: UserStatus.ACTIVE };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);
      const passwords = (service as any).passwords as { verify: jest.Mock };
      passwords.verify.mockResolvedValue(true);
      tokenService.issueTokens.mockResolvedValue({ accessToken: 'a', accessMaxAge: 1000 });

      const result = await service.login({ email: 'a@a.com', password: '12345678' }, req, res);

      expect(passwords.verify).toHaveBeenCalledWith('hash', '12345678');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(metrics.recordLogin).toHaveBeenCalledWith('password');
      expect(tokenService.issueTokens).toHaveBeenCalledWith(user, req, res);
      expect(result).toEqual({ accessToken: 'a', accessMaxAge: 1000 });
    });
  });

  describe('refresh', () => {
    it('delegates to RefreshService', async () => {
      refreshService.refresh.mockResolvedValue({ accessToken: 'new', accessMaxAge: 1000 });

      const result = await service.refresh(req, res);

      expect(refreshService.refresh).toHaveBeenCalledWith(req, res);
      expect(result).toEqual({ accessToken: 'new', accessMaxAge: 1000 });
    });
  });

  describe('logout', () => {
    it('clears cookie when refresh token is missing', async () => {
      req.cookies = {};

      const result = await service.logout(req, res);

      expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
      expect(tokenService.revokeRefreshSession).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('revokes a matched refresh token and clears cookie', async () => {
      req.cookies = { refreshToken: 'refresh' };

      await service.logout(req, res);

      expect(tokenService.revokeRefreshSession).toHaveBeenCalledWith('refresh');
      expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
    });
  });

  describe('issueCsrf', () => {
    it('returns csrf token from CsrfService', () => {
      expect(service.issueCsrf(res)).toEqual({ csrfToken: 'csrf-token' });
    });
  });

  describe('vkExchange', () => {
    it('delegates to SocialService', async () => {
      const dto = { code: 'code', device_id: 'device', code_verifier: 'verifier' } as any;
      socialService.vkExchange.mockResolvedValue({ accessToken: 'access', accessMaxAge: 1000 });

      const result = await service.vkExchange(dto, req, res);

      expect(socialService.vkExchange).toHaveBeenCalledWith(dto, req, res);
      expect(result).toEqual({ accessToken: 'access', accessMaxAge: 1000 });
    });
  });
});
