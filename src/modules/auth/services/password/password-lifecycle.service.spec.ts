import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { EmailTokenPurpose, RevokedReason } from '@prisma/client';
import { PasswordLifecycleService } from './password-lifecycle.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { EmailTokenService } from '../email/email-token.service';
import { AuthEmailService } from '../email/auth-email.service';
import { PasswordService } from './password.service';
import { Logger } from 'nestjs-pino';
import { MetricsService } from 'src/infra/metrics/metrics.service';

describe('PasswordLifecycleService', () => {
  let service: PasswordLifecycleService;
  let prisma: any;
  let emailTokens: { issue: jest.Mock; consume: jest.Mock; invalidateUnused: jest.Mock };
  let authEmail: { sendPasswordReset: jest.Mock };
  let passwords: { hash: jest.Mock; verify: jest.Mock };
  let res: { clearCookie: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      emailToken: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<void>) =>
      cb(prisma),
    );
    emailTokens = {
      issue: jest.fn(),
      consume: jest.fn(),
      invalidateUnused: jest.fn(),
    };
    authEmail = { sendPasswordReset: jest.fn() };
    passwords = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      verify: jest.fn(),
    };
    res = { clearCookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailTokenService, useValue: emailTokens },
        { provide: AuthEmailService, useValue: authEmail },
        { provide: PasswordService, useValue: passwords },
        { provide: Logger, useValue: { warn: jest.fn(), error: jest.fn() } },
        { provide: MetricsService, useValue: { recordAuthLogout: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('localhost') },
        },
      ],
    }).compile();

    service = module.get(PasswordLifecycleService);
  });

  it('forgotPassword always returns ok and does not reveal missing users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.forgotPassword('missing@example.com')).resolves.toEqual({ ok: true });
    expect(emailTokens.issue).not.toHaveBeenCalled();
  });

  it('forgotPassword sends reset mail for users with password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      password: 'hash',
    });
    emailTokens.issue.mockResolvedValue('raw-token');

    await expect(service.forgotPassword('a@a.com')).resolves.toEqual({ ok: true });
    expect(authEmail.sendPasswordReset).toHaveBeenCalledWith('a@a.com', 'raw-token');
  });

  it('forgotPassword does not email vk-only accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'vk@a.com',
      password: null,
    });

    await expect(service.forgotPassword('vk@a.com')).resolves.toEqual({ ok: true });
    expect(emailTokens.issue).not.toHaveBeenCalled();
  });

  it('changePassword rejects same password', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.changePassword('u1', 'samepass12', 'samepass12', res as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changePassword rejects accounts without password login', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: null });

    await expect(
      service.changePassword('u1', 'oldpass12', 'newpass12', res as any),
    ).rejects.toThrow('Password login is not available');
  });

  it('resetPassword updates hash, revokes sessions, invalidates reset tokens, clears cookie', async () => {
    emailTokens.consume.mockResolvedValue({ userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'old' });

    await expect(service.resetPassword('token', 'newpass12', res as any)).resolves.toEqual({
      ok: true,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'new-hash' },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        revokedReason: RevokedReason.PASSWORD_CHANGED,
      },
    });
    expect(prisma.emailToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        purpose: EmailTokenPurpose.PASSWORD_RESET,
        usedAt: null,
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ path: '/', httpOnly: true }),
    );
  });

  it('changePassword rejects wrong current password', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.changePassword('u1', 'wrongpass', 'newpass12', res as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('changePassword updates password, revokes sessions, clears cookie', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    passwords.verify.mockResolvedValue(true);

    await expect(
      service.changePassword('u1', 'oldpass12', 'newpass12', res as any),
    ).resolves.toEqual({ ok: true });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ path: '/', httpOnly: true }),
    );
  });
});
