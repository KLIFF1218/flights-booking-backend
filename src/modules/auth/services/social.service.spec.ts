import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { Provider } from '@prisma/client';
import axios from 'axios';
import { SocialService } from './social.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TokenService } from './token.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { Logger } from 'nestjs-pino';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

describe('SocialService', () => {
  let service: SocialService;
  let prisma: any;
  let redis: { setIfNotExists: jest.Mock; getDelete: jest.Mock };
  let tokenService: { issueTokens: jest.Mock };

  const req = { headers: { 'user-agent': 'vk-agent' }, ip: '1.1.1.1' } as any;
  const res = { cookie: jest.fn() } as any;

  const vkConfig = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        VK_CLIENT_ID: 'vk-id',
        VK_CLIENT_SECRET: 'vk-secret',
        VK_GRANT_TYPE: 'authorization_code',
        VK_REDIRECT_URI: 'https://example.com/callback',
      };
      return map[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      account: {
        upsert: jest.fn(),
      },
    };

    redis = {
      setIfNotExists: jest.fn().mockResolvedValue(true),
      getDelete: jest.fn().mockResolvedValue({ createdAt: Date.now() }),
    };

    tokenService = {
      issueTokens: jest.fn().mockResolvedValue({
        accessToken: 'access',
        accessMaxAge: 1000,
        csrfToken: 'csrf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: { error: jest.fn(), log: jest.fn() } },
        { provide: TokenService, useValue: tokenService },
        { provide: MetricsService, useValue: { recordLogin: jest.fn(), recordLoginFailure: jest.fn() } },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: vkConfig },
      ],
    }).compile();

    service = module.get(SocialService);
  });

  it('prepareVkState stores oauth state in redis', async () => {
    await expect(service.prepareVkState('state-123')).resolves.toEqual({ ok: true });
    expect(redis.setIfNotExists).toHaveBeenCalledWith(
      'oauth:vk:state:state-123',
      expect.objectContaining({ createdAt: expect.any(Number) }),
      600,
    );
  });

  it('prepareVkState rejects duplicate state', async () => {
    redis.setIfNotExists.mockResolvedValue(false);
    await expect(service.prepareVkState('state-123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('prepareVkState fails when VK is not configured', async () => {
    const broken = new SocialService(
      prisma,
      { error: jest.fn() } as any,
      tokenService as any,
      { recordLoginFailure: jest.fn() } as any,
      redis as any,
      { get: jest.fn().mockReturnValue('') } as any,
    );

    await expect(broken.prepareVkState('state')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('vkExchange logs in existing vk user and issues tokens', async () => {
    axiosMock.post.mockResolvedValue({
      data: { access_token: 'vk-access', user_id: 42 },
    });
    axiosMock.get.mockResolvedValue({
      data: { user: { email: 'vk@example.com', first_name: 'Vk', last_name: 'User' } },
    });

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-vk',
      email: 'vk@example.com',
      firstName: 'Vk',
      lastName: 'User',
      status: 'ACTIVE',
    });

    const dto = {
      code: 'code',
      device_id: 'device',
      code_verifier: 'verifier',
      state: 'state-1',
    } as any;

    const result = await service.vkExchange(dto, req, res);

    expect(redis.getDelete).toHaveBeenCalled();
    expect(prisma.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerAccountId: {
            provider: Provider.VK,
            providerAccountId: '42',
          },
        },
      }),
    );
    expect(tokenService.issueTokens).toHaveBeenCalled();
    expect(result.accessToken).toBe('access');
  });

  it('vkExchange auto-links verified email account', async () => {
    axiosMock.post.mockResolvedValue({
      data: { access_token: 'vk-access', user_id: 99 },
    });
    axiosMock.get.mockResolvedValue({
      data: { user: { email: 'linked@example.com', first_name: 'A', last_name: 'B' } },
    });

    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-email',
        email: 'linked@example.com',
        emailVerifiedAt: new Date(),
        firstName: null,
        lastName: null,
      });

    prisma.user.update.mockResolvedValue({
      id: 'user-email',
      email: 'linked@example.com',
      status: 'ACTIVE',
    });

    await service.vkExchange(
      { code: 'c', device_id: 'd', code_verifier: 'v', state: 's' } as any,
      req,
      res,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-email' },
      data: expect.objectContaining({ vkId: '99' }),
    });
  });

  it('vkExchange creates new vk user when email is not verified', async () => {
    axiosMock.post.mockResolvedValue({
      data: { access_token: 'vk-access', user_id: 7 },
    });
    axiosMock.get.mockResolvedValue({
      data: { user: { email: 'new@example.com', first_name: 'N', last_name: 'U' } },
    });

    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'other',
        email: 'new@example.com',
        emailVerifiedAt: null,
      })
      .mockResolvedValueOnce({ id: 'other' });

    prisma.user.create.mockResolvedValue({
      id: 'user-new',
      status: 'ACTIVE',
    });

    await service.vkExchange(
      { code: 'c', device_id: 'd', code_verifier: 'v', state: 's' } as any,
      req,
      res,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vkId: '7',
          email: null,
        }),
      }),
    );
  });
});
