import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Currency, UserStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { UsersService } from 'src/modules/users/users.service';
import { MetricsService } from '../../../infra/metrics/metrics.service';
import { TokenService } from './token.service';
import { RefreshService } from './refresh.service';
import { SocialService } from './social.service';
import { CsrfService } from './csrf.service';
import { PasswordService } from './password.service';
import { EmailVerificationService } from './email-verification.service';
import { VkIdAuthDto } from '../dtos/vk-id.auth.dto';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import {
  resolveCountryFromLocale,
  resolveCurrencyFromLocale,
} from 'src/shared/locale/locale-defaults.util';

const INVALID_CREDENTIALS = 'Invalid login or password';

@Injectable()
export class AuthService {
  private readonly COOKIE_DOMAIN: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly usersService: UsersService,
    private readonly metrics: MetricsService,
    private readonly tokenService: TokenService,
    private readonly refreshService: RefreshService,
    private readonly socialService: SocialService,
    private readonly csrfService: CsrfService,
    private readonly passwords: PasswordService,
    private readonly emailVerification: EmailVerificationService,
  ) {
    this.COOKIE_DOMAIN = config.getOrThrow<string>('COOKIES_DOMAIN');
  }

  issueCsrf(res: Response) {
    return { csrfToken: this.csrfService.issueToken(res) };
  }

  async register(dto: RegisterDto, req: Request, res: Response) {
    const { email, password, firstName, lastName } = dto;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('User already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await this.passwords.hash(password),
        firstName,
        lastName,
        currency:
          dto.currency && Object.values(Currency).includes(dto.currency as Currency)
            ? (dto.currency as Currency)
            : resolveCurrencyFromLocale(dto.locale),
        country: resolveCountryFromLocale(dto.locale),
      },
    });

    await this.emailVerification.sendForUserSafe(user.id);

    runSafely(() => this.metrics.recordLogin('register'));

    return this.tokenService.issueTokens(user, req, res);
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.password) {
      runSafely(() => this.metrics.recordLoginFailure('password', 'no_password'));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status === UserStatus.BLOCKED || user.status === UserStatus.INACTIVE) {
      runSafely(() => this.metrics.recordLoginFailure('password', 'blocked'));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const valid = await this.passwords.verify(user.password, dto.password);
    if (!valid) {
      runSafely(() => this.metrics.recordLoginFailure('password', 'invalid_credentials'));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    runSafely(() => this.metrics.recordLogin('password'));

    return this.tokenService.issueTokens(user, req, res);
  }

  async refresh(req: Request, res: Response) {
    return this.refreshService.refresh(req, res);
  }

  /* ========================== LOGOUT ========================== */

  async logout(req: Request, res: Response): Promise<{ success: true }> {
    const refreshToken =
      typeof req.cookies?.refreshToken === 'string' ? req.cookies.refreshToken : undefined;

    this.tokenService.clearRefreshCookie(res);

    if (refreshToken) {
      await this.tokenService.revokeRefreshSession(refreshToken);
    }

    runSafely(() => this.metrics.recordAuthLogout('single'));

    return { success: true };
  }

  /* ========================== VK AUTH ========================== */

  async vkExchange(dto: VkIdAuthDto, req: Request, res: Response) {
    return this.socialService.vkExchange(dto, req, res);
  }
}
