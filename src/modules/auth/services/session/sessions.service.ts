import { Injectable, NotFoundException } from '@nestjs/common';
import { verify } from 'argon2';
import { RevokedReason } from '@prisma/client';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import type { SessionResponseDto } from '../../dtos/session/session.response.dto';
import { clearRefreshCookie } from '../../utils/clear-refresh-cookie';

@Injectable()
export class SessionsService {
  private readonly cookieDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.cookieDomain = config.getOrThrow<string>('COOKIES_DOMAIN');
  }

  async listSessions(userId: string, req: Request): Promise<{ sessions: SessionResponseDto[] }> {
    const currentRefreshId = await this.findCurrentRefreshTokenId(userId, req);

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        userDevice: {
          select: {
            id: true,
            userAgent: true,
            ip: true,
            lastSeen: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      sessions: tokens.map((token) => ({
        id: token.id,
        deviceId: token.userDeviceId,
        userAgent: token.deviceInfo ?? token.userDevice.userAgent ?? null,
        ip: token.ip ?? token.userDevice.ip ?? null,
        createdAt: token.createdAt,
        lastSeen: token.userDevice.lastSeen,
        expiresAt: token.expiresAt,
        current: token.id === currentRefreshId,
      })),
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    req: Request,
    res: Response,
  ): Promise<{ ok: true; revokedCurrent: boolean }> {
    const token = await this.prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!token) {
      throw new NotFoundException('Session not found');
    }

    const currentRefreshId = await this.findCurrentRefreshTokenId(userId, req);
    const revokedCurrent = token.id === currentRefreshId;

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: {
        revokedAt: new Date(),
        revokedReason: RevokedReason.LOGOUT,
      },
    });

    if (revokedCurrent) {
      this.clearRefreshCookie(res);
    }

    runSafely(() => this.metrics.recordAuthLogout('single'));

    return { ok: true, revokedCurrent };
  }

  async logoutAll(userId: string, res: Response): Promise<{ ok: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: RevokedReason.LOGOUT,
      },
    });

    this.clearRefreshCookie(res);
    runSafely(() => this.metrics.recordAuthLogout('all'));

    return { ok: true };
  }

  private async findCurrentRefreshTokenId(userId: string, req: Request): Promise<string | null> {
    const refreshToken =
      typeof req.cookies?.refreshToken === 'string' ? req.cookies.refreshToken : undefined;

    if (!refreshToken) {
      return null;
    }

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, tokenHash: true },
    });

    for (const token of activeTokens) {
      if (await verify(token.tokenHash, refreshToken)) {
        return token.id;
      }
    }

    return null;
  }

  private clearRefreshCookie(res: Response) {
    clearRefreshCookie(res, this.cookieDomain);
  }
}
