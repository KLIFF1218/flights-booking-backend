import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { EmailTokenPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

const TOKEN_BYTES = 32;

@Injectable()
export class EmailTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Invalidates prior unused tokens for the same purpose and issues a new one.
   * Returns the raw token to embed in the email link (never stored in plaintext).
   */
  async issue(userId: string, purpose: EmailTokenPurpose, ttlMs: number): Promise<string> {
    const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.$transaction([
      this.prisma.emailToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailToken.create({
        data: {
          userId,
          purpose,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);

    return rawToken;
  }

  async consume(rawToken: string, purpose: EmailTokenPurpose): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.emailToken.findFirst({
      where: {
        tokenHash,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const updated = await this.prisma.emailToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return { userId: record.userId };
  }
}
