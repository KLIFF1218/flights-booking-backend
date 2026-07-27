import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { UsersService } from 'src/modules/users/users.service';
import { TokenService } from './token.service';
import { JwtPayload } from 'src/modules/auth/interfaces';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { RevokedReason } from '@prisma/client';
import { CsrfService } from './csrf.service';

/** Concurrent multi-tab refresh window — do not treat as replay attack. */
const CONCURRENT_ROTATION_GRACE_MS = 5_000;

@Injectable()
export class RefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly metrics: MetricsService,
    private readonly csrfService: CsrfService,
  ) {}

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken =
        typeof req.cookies?.refreshToken === 'string' ? req.cookies.refreshToken : undefined;
      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token is missing');
      }

      let payload: JwtPayload;
      try {
        payload = this.jwt.verify<JwtPayload>(refreshToken, {
          secret: this.tokenService.getRefreshSecret(),
        });
      } catch {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      if (payload.typ !== 'refresh') {
        throw new UnauthorizedException('Refresh token is invalid');
      }

      const activeTokens = await this.prisma.refreshToken.findMany({
        where: {
          userId: payload.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      const matched = await this.tokenService.findRefreshToken(activeTokens, refreshToken);

      if (!matched) {
        await this.revokeAllForReuse(payload.id);
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const revokeResult = await this.prisma.refreshToken.updateMany({
        where: { id: matched.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: RevokedReason.REFRESH_ROTATION,
        },
      });

      if (revokeResult.count === 0) {
        await this.handleLostRotationRace(payload.id, matched.id);
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const user = await this.usersService.getById(payload.id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tokens = await this.tokenService.generateTokens(user, req);

      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: { replacedById: tokens.refreshTokenId },
      });

      this.tokenService.setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAge);
      const csrfToken = this.csrfService.issueToken(res);

      runSafely(() => this.metrics.recordAuthRefresh('success'));

      return {
        accessToken: tokens.accessToken,
        accessMaxAge: tokens.accessMaxAge,
        csrfToken,
      };
    } catch (error) {
      this.tokenService.clearRefreshCookie(res);
      runSafely(() => this.metrics.recordAuthRefresh('failure'));
      throw error;
    }
  }

  /**
   * When two refreshes race on the same token, the loser sees count=0.
   * If the winner rotated within the grace window, skip full-session revoke.
   * Otherwise treat as replay and revoke all.
   */
  private async handleLostRotationRace(userId: string, tokenId: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      select: { revokedAt: true, revokedReason: true },
    });

    const recentlyRotated =
      existing?.revokedReason === RevokedReason.REFRESH_ROTATION &&
      existing.revokedAt != null &&
      Date.now() - existing.revokedAt.getTime() < CONCURRENT_ROTATION_GRACE_MS;

    if (recentlyRotated) {
      return;
    }

    await this.revokeAllForReuse(userId);
  }

  private async revokeAllForReuse(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: RevokedReason.REPLAY_ATTACK,
      },
    });
  }
}
