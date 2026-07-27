import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

export function assertUserNotBlocked(status: UserStatus): void {
  if (status === UserStatus.BLOCKED || status === UserStatus.INACTIVE) {
    throw new UnauthorizedException('Account is blocked');
  }
}
