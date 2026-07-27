import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { Prisma, Provider } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { VkIdAuthDto } from '../dtos/vk-id.auth.dto';
import { Logger } from 'nestjs-pino';
import { TokenService } from './token.service';
import { Request, Response } from 'express';
import type { VkExchangeTokenResponse, VkUserInfo } from '../types/vk-id.response';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { RedisService } from 'src/infra/redis/redis.service';

const VK_OAUTH_STATE_TTL_SECONDS = 600;
const vkOAuthStateKey = (state: string) => `oauth:vk:state:${state}`;

@Injectable()
export class SocialService {
  private readonly VK_CLIENT_ID: string;
  private readonly VK_CLIENT_SECRET: string;
  private readonly VK_REDIRECT_URI: string;
  private readonly VK_GRANT_TYPE: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly tokenService: TokenService,
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.VK_CLIENT_ID = config.get<string>('VK_CLIENT_ID')?.trim() ?? '';
    this.VK_CLIENT_SECRET = config.get<string>('VK_CLIENT_SECRET')?.trim() ?? '';
    this.VK_GRANT_TYPE = config.get<string>('VK_GRANT_TYPE')?.trim() ?? '';
    this.VK_REDIRECT_URI = config.get<string>('VK_REDIRECT_URI')?.trim() ?? '';
  }

  private assertVkConfigured(): void {
    if (
      !this.VK_CLIENT_ID ||
      !this.VK_CLIENT_SECRET ||
      !this.VK_GRANT_TYPE ||
      !this.VK_REDIRECT_URI
    ) {
      throw new ServiceUnavailableException('VK login is not configured');
    }
  }

  async prepareVkState(state: string): Promise<{ ok: true }> {
    this.assertVkConfigured();

    const stored = await this.redis.setIfNotExists(
      vkOAuthStateKey(state),
      { createdAt: Date.now() },
      VK_OAUTH_STATE_TTL_SECONDS,
    );

    if (!stored) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    return { ok: true };
  }

  private async consumeVkState(state: string): Promise<void> {
    const existing = await this.redis.getDelete<{ createdAt: number }>(vkOAuthStateKey(state));
    if (!existing) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  async exchangeVkCode(dto: VkIdAuthDto): Promise<VkExchangeTokenResponse> {
    this.assertVkConfigured();

    try {
      const { data } = await axios.post<VkExchangeTokenResponse>(
        'https://id.vk.ru/oauth2/auth',
        new URLSearchParams({
          grant_type: this.VK_GRANT_TYPE,
          client_id: this.VK_CLIENT_ID,
          client_secret: this.VK_CLIENT_SECRET,
          redirect_uri: this.VK_REDIRECT_URI,
          code: dto.code,
          device_id: dto.device_id,
          code_verifier: dto.code_verifier,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      return data;
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        this.logger.error(e.response?.data, 'VK exchange failed');
      }
      this.logger.error({ err: e }, 'VK exchange failed');
      runSafely(() => this.metrics.recordLoginFailure('vk', 'exchange_failed'));
      throw new UnauthorizedException('VK authorization failed');
    }
  }

  private async ensureVkAccount(userId: string, vkId: string): Promise<void> {
    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: Provider.VK,
          providerAccountId: vkId,
        },
      },
      create: {
        provider: Provider.VK,
        providerAccountId: vkId,
        userId,
      },
      update: {
        userId,
      },
    });
  }

  async vkExchange(dto: VkIdAuthDto, req: Request, res: Response) {
    try {
      this.assertVkConfigured();
      await this.consumeVkState(dto.state);

      const vkTokens = await this.exchangeVkCode(dto);

      if (!vkTokens.access_token || !vkTokens.user_id) {
        runSafely(() => this.metrics.recordLoginFailure('vk', 'invalid_tokens'));
        throw new UnauthorizedException('VK tokens are invalid');
      }

      let userInfo: VkUserInfo | undefined;

      try {
        const { data } = await axios.get<{ user: VkUserInfo }>(
          'https://id.vk.ru/oauth2/user_info',
          {
            params: {
              client_id: this.VK_CLIENT_ID,
            },
            headers: {
              Authorization: `Bearer ${vkTokens.access_token}`,
            },
          },
        );

        userInfo = data.user;
      } catch (e: unknown) {
        if (isAxiosError(e)) {
          this.logger.error(e.response?.data, 'VK userInfo failed');
        }
        runSafely(() => this.metrics.recordLoginFailure('vk', 'user_info_failed'));
        throw new UnauthorizedException('Failed to fetch VK user info');
      }

      const vkId = String(vkTokens.user_id);
      const email = userInfo?.email ?? null;
      const firstName = userInfo?.first_name ?? null;
      const lastName = userInfo?.last_name ?? null;

      let user = await this.prisma.user.findUnique({
        where: { vkId },
      });

      if (user) {
        const updateData: Prisma.UserUpdateInput = {};

        if (!user.firstName && firstName) updateData.firstName = firstName;
        if (!user.lastName && lastName) updateData.lastName = lastName;
        // Only attach email when the slot is empty — never overwrite a local email.
        if (!user.email && email) {
          const emailTaken = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });
          if (!emailTaken) {
            updateData.email = email;
          }
        }

        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }

        await this.ensureVkAccount(user.id, vkId);
        runSafely(() => this.metrics.recordLogin('vk'));
        return this.tokenService.issueTokens(user, req, res);
      }

      if (email) {
        const existingByEmail = await this.prisma.user.findUnique({
          where: { email },
        });

        // Safe auto-link only for accounts that already verified that email.
        if (existingByEmail?.emailVerifiedAt) {
          const updateData: Prisma.UserUpdateInput = {
            vkId,
          };

          if (!existingByEmail.firstName && firstName) updateData.firstName = firstName;
          if (!existingByEmail.lastName && lastName) updateData.lastName = lastName;

          user = await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: updateData,
          });

          await this.ensureVkAccount(user.id, vkId);
          runSafely(() => this.metrics.recordLogin('vk'));
          return this.tokenService.issueTokens(user, req, res);
        }
      }

      // Email belongs to an unverified (or unknown) account: create VK user without claiming it.
      const emailAvailable =
        email !== null
          ? !(await this.prisma.user.findUnique({ where: { email }, select: { id: true } }))
          : false;

      user = await this.prisma.user.create({
        data: {
          vkId,
          email: emailAvailable ? email : null,
          firstName,
          lastName,
          accounts: {
            create: {
              provider: Provider.VK,
              providerAccountId: vkId,
            },
          },
        },
      });

      runSafely(() => this.metrics.recordLogin('vk'));
      return this.tokenService.issueTokens(user, req, res);
    } catch (error) {
      if (!(error instanceof UnauthorizedException) && !(error instanceof ServiceUnavailableException)) {
        runSafely(() => this.metrics.recordLoginFailure('vk', 'authorization_failed'));
      }
      throw error;
    }
  }
}
