import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTokenPurpose, RevokedReason } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { EmailTokenService } from './email-token.service';
import { AuthEmailService } from './auth-email.service';
import { PasswordService } from './password.service';
import { Logger } from 'nestjs-pino';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { clearRefreshCookie } from '../utils/clear-refresh-cookie';

const RESET_TTL_MS = 1000 * 60 * 60; // 1h

@Injectable()
export class PasswordLifecycleService {
  private readonly cookieDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailTokenService,
    private readonly authEmail: AuthEmailService,
    private readonly passwords: PasswordService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {
    this.cookieDomain = config.getOrThrow<string>('COOKIES_DOMAIN');
  }

  /**
   * Always returns ok to avoid email enumeration.
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (user?.email && user.password) {
      try {
        const token = await this.emailTokens.issue(
          user.id,
          EmailTokenPurpose.PASSWORD_RESET,
          RESET_TTL_MS,
        );
        await this.authEmail.sendPasswordReset(user.email, token);
      } catch (error: unknown) {
        this.logger.warn(
          { err: error instanceof Error ? error : String(error), userId: user.id },
          'Password reset email failed',
        );
      }
    }

    return { ok: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    res?: Response,
  ): Promise<{ ok: true }> {
    const { userId } = await this.emailTokens.consume(token, EmailTokenPurpose.PASSWORD_RESET);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.applyPasswordChange(userId, newPassword);

    if (res) {
      this.clearRefreshCookie(res);
    }

    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    res: Response,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user?.password) {
      throw new BadRequestException('Password login is not available for this account');
    }

    const valid = await this.passwords.verify(user.password, currentPassword);
    if (!valid) {
      // 400 (not 401): client is authenticated; wrong password must not trigger
      // frontend session-refresh / logout-on-401 handling.
      throw new BadRequestException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    await this.applyPasswordChange(userId, newPassword);
    this.clearRefreshCookie(res);

    return { ok: true };
  }

  private async applyPasswordChange(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: RevokedReason.PASSWORD_CHANGED,
        },
      });

      await tx.emailToken.updateMany({
        where: {
          userId,
          purpose: EmailTokenPurpose.PASSWORD_RESET,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
    });

    runSafely(() => this.metrics.recordAuthLogout('all'));
  }

  private clearRefreshCookie(res: Response): void {
    clearRefreshCookie(res, this.cookieDomain);
  }
}
