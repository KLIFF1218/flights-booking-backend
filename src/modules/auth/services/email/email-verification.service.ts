import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailTokenPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { EmailTokenService } from './email-token.service';
import { AuthEmailService } from './auth-email.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { Logger } from 'nestjs-pino';

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailTokenService,
    private readonly authEmail: AuthEmailService,
    private readonly logger: Logger,
  ) {}

  async sendForUser(userId: string, locale?: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new BadRequestException('Account has no email to verify');
    }

    if (user.emailVerifiedAt) {
      return { ok: true };
    }

    await this.issueAndSend(user.id, user.email, locale);
    return { ok: true };
  }

  /** Best-effort send after register / email change — never fails the primary flow. */
  async sendForUserSafe(userId: string, locale?: string): Promise<boolean> {
    try {
      await this.sendForUser(userId, locale);
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error), userId },
        'Verification email skipped',
      );
      return false;
    }
  }

  async confirm(token: string): Promise<{ ok: true }> {
    const { userId } = await this.emailTokens.consume(token, EmailTokenPurpose.EMAIL_VERIFY);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user?.email) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return { ok: true };
  }

  private async issueAndSend(userId: string, email: string, locale?: string): Promise<void> {
    const token = await this.emailTokens.issue(
      userId,
      EmailTokenPurpose.EMAIL_VERIFY,
      VERIFY_TTL_MS,
    );

    try {
      await this.authEmail.sendVerification(email, token, locale);
      runSafely(() => undefined);
    } catch {
      // Token remains valid so the user can request resend; primary API already returned.
      throw new BadRequestException('Failed to send verification email');
    }
  }
}
