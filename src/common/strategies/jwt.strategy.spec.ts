import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-access-secret-min-32-characters!!';
              return undefined;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-access-secret-min-32-characters!!';
              throw new Error(`missing ${key}`);
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('rejects refresh-typed jwt payload', async () => {
    await expect(strategy.validate({ id: 'u1', typ: 'refresh' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns user for valid access payload', async () => {
    const user = {
      id: 'u1',
      email: 'a@a.com',
      firstName: 'A',
      lastName: 'B',
      vkId: null,
      status: UserStatus.ACTIVE,
      phone: null,
      role: 'USER',
    };
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(strategy.validate({ id: 'u1', typ: 'access' })).resolves.toEqual(user);
  });

  it('rejects missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ id: 'missing', typ: 'access' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
