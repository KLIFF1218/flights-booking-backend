import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IS_DEV_NODE } from 'src/common/utils/is-dev';
import { assertUserNotBlocked } from 'src/common/utils/assert-user-active';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { RefreshToken, RevokedReason, User } from '@prisma/client';
import { Request, Response } from 'express';
import { hash, verify } from 'argon2';
import { JwtPayload } from 'src/modules/auth/interfaces';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { parseDurationMs } from 'src/common/utils/parse-duration.util';
import { getJwtAccessSecret, getJwtRefreshSecret } from 'src/config/jwt-secrets';
import { CsrfService } from './csrf.service';
import { clearRefreshCookie } from '../utils/clear-refresh-cookie';

type TokenUser = Pick<User, 'id' | 'status'>;

export type IssuedTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
  refreshTokenId: string;
};

@Injectable()
export class TokenService {
  private readonly ACCESS_EXPIRES: number;
  private readonly REFRESH_EXPIRES: number;
  private readonly COOKIE_DOMAIN: string;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly csrfService: CsrfService,
  ) {
    this.ACCESS_EXPIRES = parseDurationMs(config.getOrThrow<string>('JWT_EXPIRES_ACCESS_TOKEN'));
    this.REFRESH_EXPIRES = parseDurationMs(config.getOrThrow<string>('JWT_EXPIRES_REFRESH_TOKEN'));
    this.COOKIE_DOMAIN = config.getOrThrow<string>('COOKIES_DOMAIN');
    this.accessSecret = getJwtAccessSecret(config);
    this.refreshSecret = getJwtRefreshSecret(config);
  }

  async issueTokens(user: TokenUser, req: Request, res: Response) {
    assertUserNotBlocked(user.status);

    const tokens = await this.generateTokens(user, req);
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAge);
    const csrfToken = this.csrfService.issueToken(res);

    return {
      accessToken: tokens.accessToken,
      accessMaxAge: tokens.accessMaxAge,
      csrfToken,
    };
  }

  async generateTokens(user: TokenUser, req: Request): Promise<IssuedTokenPair> {
    assertUserNotBlocked(user.status);
    const startedAt = Date.now();

    const accessPayload: JwtPayload = { id: user.id, typ: 'access' };
    const refreshPayload: JwtPayload = { id: user.id, typ: 'refresh' };

    const accessToken = this.jwt.sign(accessPayload, {
      secret: this.accessSecret,
      expiresIn: this.ACCESS_EXPIRES,
    });

    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.REFRESH_EXPIRES,
    });

    let userDevice = await this.prisma.userDevice.findFirst({
      where: {
        userId: user.id,
        userAgent: req.headers['user-agent'],
      },
    });

    if (!userDevice) {
      userDevice = await this.prisma.userDevice.create({
        data: {
          userId: user.id,
          userAgent: req.headers['user-agent'] as string,
          ip: req.ip,
          lastIp: req.ip,
        },
      });
    } else {
      userDevice = await this.prisma.userDevice.update({
        where: { id: userDevice.id },
        data: {
          lastIp: req.ip,
          // Touch lastSeen explicitly (also covered by @updatedAt on writes).
          lastSeen: new Date(),
        },
      });
    }

    const created = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        userDeviceId: userDevice.id,
        tokenHash: await hash(refreshToken),
        expiresAt: new Date(Date.now() + this.REFRESH_EXPIRES),
        deviceInfo: req.headers['user-agent'],
        ip: req.ip,
      },
      select: { id: true },
    });

    runSafely(() => {
      const durationSeconds = (Date.now() - startedAt) / 1000;
      this.metrics.recordAuthTokenDuration(durationSeconds, 'pair');
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAge: this.ACCESS_EXPIRES,
      refreshMaxAge: this.REFRESH_EXPIRES,
      refreshTokenId: created.id,
    };
  }

  setRefreshCookie(res: Response, token: string, maxAge: number) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: !IS_DEV_NODE,
      sameSite: 'lax',
      path: '/',
      maxAge,
      ...(IS_DEV_NODE ? {} : { domain: this.COOKIE_DOMAIN }),
    });
  }

  clearRefreshCookie(res: Response): void {
    clearRefreshCookie(res, this.COOKIE_DOMAIN);
  }

  async revokeRefreshSession(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.typ !== 'refresh') {
        return;
      }

      const activeTokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.id, revokedAt: null },
      });

      const matched = await this.findRefreshToken(activeTokens, refreshToken);
      if (!matched) {
        return;
      }

      await this.prisma.refreshToken.update({
        where: { id: matched.id },
        data: {
          revokedAt: new Date(),
          revokedReason: RevokedReason.LOGOUT,
        },
      });
    } catch {
      // Stale or malformed refresh cookie — cookie is cleared on the response.
    }
  }

  async findRefreshToken(tokens: RefreshToken[], token: string) {
    for (const t of tokens) {
      if (await verify(t.tokenHash, token)) {
        return t;
      }
    }
    return null;
  }

  getRefreshSecret(): string {
    return this.refreshSecret;
  }
}
