import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { RevokedReason } from '@prisma/client';
import { verify } from 'argon2';
import { SessionsService } from './sessions.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from 'src/infra/metrics/metrics.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

const verifyMock = verify as jest.MockedFunction<typeof verify>;

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: any;
  const res = { clearCookie: jest.fn() } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      refreshToken: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('localhost') },
        },
        { provide: MetricsService, useValue: { recordAuthLogout: jest.fn() } },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  it('lists sessions and marks the current cookie session', async () => {
    prisma.refreshToken.findMany
      .mockResolvedValueOnce([
        { id: 'rt-1', tokenHash: 'h1' },
        { id: 'rt-2', tokenHash: 'h2' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rt-1',
          userDeviceId: 'd1',
          deviceInfo: 'Chrome',
          ip: '1.1.1.1',
          createdAt: new Date('2026-01-01'),
          expiresAt: new Date('2026-02-01'),
          userDevice: {
            id: 'd1',
            userAgent: 'Chrome',
            ip: '1.1.1.1',
            lastSeen: new Date('2026-01-02'),
          },
        },
        {
          id: 'rt-2',
          userDeviceId: 'd2',
          deviceInfo: 'Firefox',
          ip: '2.2.2.2',
          createdAt: new Date('2026-01-01'),
          expiresAt: new Date('2026-02-01'),
          userDevice: {
            id: 'd2',
            userAgent: 'Firefox',
            ip: '2.2.2.2',
            lastSeen: new Date('2026-01-02'),
          },
        },
      ]);
    verifyMock.mockResolvedValueOnce(true);

    const result = await service.listSessions('user-1', {
      cookies: { refreshToken: 'cookie' },
    } as any);

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].current).toBe(true);
    expect(result.sessions[1].current).toBe(false);
  });

  it('revokes a session and clears cookie when current', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-1', tokenHash: 'h1' }]);
    verifyMock.mockResolvedValue(true);

    const result = await service.revokeSession(
      'user-1',
      'rt-1',
      { cookies: { refreshToken: 'cookie' } } as any,
      res,
    );

    expect(result).toEqual({ ok: true, revokedCurrent: true });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.LOGOUT,
      },
    });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('revokes a session without clearing cookie when not current', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-2' });
    prisma.refreshToken.findMany.mockResolvedValue([{ id: 'rt-1', tokenHash: 'h1' }]);
    verifyMock.mockResolvedValue(true);

    const result = await service.revokeSession(
      'user-1',
      'rt-2',
      { cookies: { refreshToken: 'cookie' } } as any,
      res,
    );

    expect(result).toEqual({ ok: true, revokedCurrent: false });
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('lists sessions with no current flag when cookie is missing', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      {
        id: 'rt-1',
        userDeviceId: 'd1',
        deviceInfo: 'Chrome',
        ip: '1.1.1.1',
        createdAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-02-01'),
        userDevice: {
          id: 'd1',
          userAgent: 'Chrome',
          ip: '1.1.1.1',
          lastSeen: new Date('2026-01-02'),
        },
      },
    ]);

    const result = await service.listSessions('user-1', { cookies: {} } as any);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].current).toBe(false);
  });

  it('throws NotFoundException for unknown session', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(
      service.revokeSession('user-1', 'missing', { cookies: {} } as any, res),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('logoutAll revokes every active token and clears cookie', async () => {
    await expect(service.logoutAll('user-1', res)).resolves.toEqual({ ok: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.LOGOUT,
      },
    });
    expect(res.clearCookie).toHaveBeenCalled();
  });
});
