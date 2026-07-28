import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { EmailTokenPurpose } from '@prisma/client';
import { createHash } from 'crypto';
import { EmailTokenService } from './email-token.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('EmailTokenService', () => {
  let service: EmailTokenService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      emailToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'et-1' }),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      for (const op of ops) {
        await op;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailTokenService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(EmailTokenService);
  });

  it('issue invalidates prior unused tokens and returns raw token', async () => {
    const raw = await service.issue('user-1', EmailTokenPurpose.EMAIL_VERIFY, 60_000);

    expect(raw).toBeTruthy();
    expect(prisma.emailToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        purpose: EmailTokenPurpose.EMAIL_VERIFY,
        usedAt: null,
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        purpose: EmailTokenPurpose.EMAIL_VERIFY,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
      }),
    });
  });

  it('consume marks token used and returns userId', async () => {
    const raw = 'known-raw-token-value-1234567890';
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    prisma.emailToken.findFirst.mockResolvedValue({ id: 'et-1', userId: 'user-1' });
    prisma.emailToken.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(service.consume(raw, EmailTokenPurpose.PASSWORD_RESET)).resolves.toEqual({
      userId: 'user-1',
    });

    expect(prisma.emailToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash,
        purpose: EmailTokenPurpose.PASSWORD_RESET,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true, userId: true },
    });
  });

  it('consume rejects unknown or expired token', async () => {
    prisma.emailToken.findFirst.mockResolvedValue(null);

    await expect(service.consume('missing', EmailTokenPurpose.EMAIL_VERIFY)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('consume rejects concurrent double-use', async () => {
    prisma.emailToken.findFirst.mockResolvedValue({ id: 'et-1', userId: 'user-1' });
    prisma.emailToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.consume('token', EmailTokenPurpose.EMAIL_VERIFY)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
