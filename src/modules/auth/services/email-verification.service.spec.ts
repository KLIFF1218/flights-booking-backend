import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { EmailVerificationService } from './email-verification.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { EmailTokenService } from './email-token.service';
import { AuthEmailService } from './auth-email.service';
import { Logger } from 'nestjs-pino';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: any;
  let emailTokens: { issue: jest.Mock; consume: jest.Mock };
  let authEmail: { sendVerification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    emailTokens = { issue: jest.fn(), consume: jest.fn() };
    authEmail = { sendVerification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailTokenService, useValue: emailTokens },
        { provide: AuthEmailService, useValue: authEmail },
        { provide: Logger, useValue: { warn: jest.fn() } },
      ],
    }).compile();

    service = module.get(EmailVerificationService);
  });

  it('sendForUser sends verification email for unverified user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      emailVerifiedAt: null,
    });
    emailTokens.issue.mockResolvedValue('raw-token');

    await expect(service.sendForUser('u1')).resolves.toEqual({ ok: true });
    expect(emailTokens.issue).toHaveBeenCalled();
    expect(authEmail.sendVerification).toHaveBeenCalledWith('a@a.com', 'raw-token');
  });

  it('confirm is idempotent when email already verified', async () => {
    emailTokens.consume.mockResolvedValue({ userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      emailVerifiedAt: new Date('2026-01-01'),
    });

    await expect(service.confirm('token')).resolves.toEqual({ ok: true });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('sendForUserSafe swallows errors', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const logger = (service as any).logger as { warn: jest.Mock };

    await expect(service.sendForUserSafe('missing')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('confirm sets emailVerifiedAt', async () => {
    emailTokens.consume.mockResolvedValue({ userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      emailVerifiedAt: null,
    });

    await expect(service.confirm('token')).resolves.toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it('confirm rejects when user has no email', async () => {
    emailTokens.consume.mockResolvedValue({ userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: null,
      emailVerifiedAt: null,
    });

    await expect(service.confirm('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sendForUser skips already verified accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      emailVerifiedAt: new Date(),
    });

    await expect(service.sendForUser('u1')).resolves.toEqual({ ok: true });
    expect(emailTokens.issue).not.toHaveBeenCalled();
  });
});
