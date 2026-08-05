import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RevokedReason } from '@prisma/client';
import { RefreshService } from './refresh.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { UsersService } from 'src/modules/users/services/users.service';
import { TokenService } from './token.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { CsrfService } from './csrf.service';

describe('RefreshService', () => {
  let service: RefreshService;
  let prisma: any;
  let jwt: { verify: jest.Mock };
  let usersService: { getById: jest.Mock };
  let tokenService: any;
  let csrfService: { issueToken: jest.Mock };

  const req = { cookies: { refreshToken: 'refresh-jwt' }, headers: {} } as any;
  const res = { cookie: jest.fn() } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      refreshToken: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    jwt = { verify: jest.fn() };
    usersService = { getById: jest.fn() };
    tokenService = {
      getRefreshSecret: jest.fn().mockReturnValue('refresh-secret'),
      findRefreshToken: jest.fn(),
      generateTokens: jest.fn(),
      setRefreshCookie: jest.fn(),
      clearRefreshCookie: jest.fn(),
    };
    csrfService = { issueToken: jest.fn().mockReturnValue('csrf-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
        {
          provide: MetricsService,
          useValue: {
            recordAuthRefresh: jest.fn(),
          },
        },
        { provide: CsrfService, useValue: csrfService },
      ],
    }).compile();

    service = module.get(RefreshService);
  });

  it('rejects access tokens used as refresh', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'access' });

    await expect(service.refresh(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.findRefreshToken).not.toHaveBeenCalled();
    expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('rejects missing refresh cookie', async () => {
    const emptyReq = { cookies: {}, headers: {} } as any;

    await expect(service.refresh(emptyReq, res)).rejects.toThrow('Refresh token is missing');
    expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('rejects invalid refresh jwt', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(service.refresh(req, res)).rejects.toThrow('Refresh token is invalid');
    expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('revokes all sessions on reuse of an unknown refresh token', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-1' }]);
    tokenService.findRefreshToken.mockResolvedValue(null);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.refresh(req, res)).rejects.toThrow('Refresh token reuse detected');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.REPLAY_ATTACK,
      },
    });
  });

  it('rotates refresh token and links replacedById', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-old' }]);
    tokenService.findRefreshToken.mockResolvedValue({ id: 'rt-old' });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    usersService.getById.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    tokenService.generateTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh-new',
      accessMaxAge: 1000,
      refreshMaxAge: 2000,
      refreshTokenId: 'rt-new',
    });

    const result = await service.refresh(req, res);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-old', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.REFRESH_ROTATION,
      },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { replacedById: 'rt-new' },
    });
    expect(tokenService.setRefreshCookie).toHaveBeenCalledWith(res, 'refresh-new', 2000);
    expect(result).toEqual({
      accessToken: 'access',
      accessMaxAge: 1000,
      csrfToken: 'csrf-token',
    });
  });

  it('throws NotFoundException when user disappears after rotation', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-old' }]);
    tokenService.findRefreshToken.mockResolvedValue({ id: 'rt-old' });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    usersService.getById.mockResolvedValue(null);

    await expect(service.refresh(req, res)).rejects.toThrow('User not found');
    expect(tokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
  });

  it('skips full revoke on concurrent rotation within grace window', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-old' }]);
    tokenService.findRefreshToken.mockResolvedValue({ id: 'rt-old' });
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.refreshToken.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      revokedReason: RevokedReason.REFRESH_ROTATION,
    });

    await expect(service.refresh(req, res)).rejects.toThrow('Refresh token reuse detected');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('revokes all when lost race is outside concurrent grace window', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1', typ: 'refresh' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-old' }]);
    tokenService.findRefreshToken.mockResolvedValue({ id: 'rt-old' });
    prisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.refreshToken.findUnique.mockResolvedValue({
      revokedAt: new Date(Date.now() - 60_000),
      revokedReason: RevokedReason.REFRESH_ROTATION,
    });

    await expect(service.refresh(req, res)).rejects.toThrow('Refresh token reuse detected');

    expect(prisma.refreshToken.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.REPLAY_ATTACK,
      },
    });
  });
});
