import { ForbiddenException } from '@nestjs/common';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';

/**
 * Payment gate: checkout requires a verified email on the account.
 */
export async function assertEmailVerifiedForPayment(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });

  if (!user) {
    throw new ForbiddenException('User not found');
  }

  if (!user.email || !user.emailVerifiedAt) {
    throw new ForbiddenException('Email verification required before payment');
  }
}
