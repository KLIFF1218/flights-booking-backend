import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus, RevokedReason } from '@prisma/client';
import { hash, verify } from 'argon2';
import { TokenService } from './token.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { CsrfService } from './csrf.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

const hashMock = hash as jest.MockedFunction<typeof hash>;
const verifyMock = verify as jest.MockedFunction<typeof verify>;

describe('TokenService', () => {
  let service: TokenService;
  let prisma: any;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let csrfService: { issueToken: jest.Mock };

  const req = {
    headers: { 'user-agent': 'jest-agent' },
    ip: '127.0.0.1',
  } as any;
  const res = { cookie: jest.fn(), clearCookie: jest.fn() } as any;

  const user = { id: 'user-1', status: UserStatus.ACTIVE };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      userDevice: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValueOnce('access-jwt').mockReturnValueOnce('refresh-jwt'),
      verify: jest.fn(),
    };
    csrfService = { issueToken: jest.fn().mockReturnValue('csrf-token') };
    hashMock.mockResolvedValue('hashed-refresh');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_EXPIRES_ACCESS_TOKEN') return '1h';
              if (key === 'JWT_EXPIRES_REFRESH_TOKEN') return '7d';
              if (key === 'COOKIES_DOMAIN') return 'localhost';
              return undefined;
            }),
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-access-secret-min-32-characters!!';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-min-32-chars!!';
              return undefined;
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: { recordAuthTokenDuration: jest.fn() },
        },
        { provide: CsrfService, useValue: csrfService },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('issueTokens sets refresh cookie and returns access + csrf', async () => {
    prisma.userDevice.findFirst.mockResolvedValue(null);
    prisma.userDevice.create.mockResolvedValue({ id: 'device-1' });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const result = await service.issueTokens(user, req, res);

    expect(result).toEqual({
      accessToken: 'access-jwt',
      accessMaxAge: expect.any(Number),
      csrfToken: 'csrf-token',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh-jwt',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(csrfService.issueToken).toHaveBeenCalledWith(res);
  });

  it('generateTokens reuses existing device by user-agent', async () => {
    prisma.userDevice.findFirst.mockResolvedValue({ id: 'device-1' });
    prisma.userDevice.update.mockResolvedValue({ id: 'device-1' });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    await service.generateTokens(user, req);

    expect(prisma.userDevice.create).not.toHaveBeenCalled();
    expect(prisma.userDevice.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: expect.objectContaining({ lastIp: '127.0.0.1' }),
    });
  });

  it('findRefreshToken matches argon2 hash', async () => {
    verifyMock.mockResolvedValue(true);

    const matched = await service.findRefreshToken(
      [{ id: 'rt-1', tokenHash: 'hash' } as any],
      'refresh-jwt',
    );

    expect(matched).toEqual({ id: 'rt-1', tokenHash: 'hash' });
    expect(verifyMock).toHaveBeenCalledWith('hash', 'refresh-jwt');
  });

  it('revokeRefreshSession revokes matched refresh token', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-1', tokenHash: 'hash' }]);
    verifyMock.mockResolvedValue(true);
    prisma.refreshToken.update.mockResolvedValue({});

    await service.revokeRefreshSession('refresh-jwt');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.LOGOUT,
      },
    });
  });

  it('revokeRefreshSession ignores access-typed jwt', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'access' });

    await service.revokeRefreshSession('access-as-refresh');

    expect(prisma.refreshToken.findMany).not.toHaveBeenCalled();
  });
});
