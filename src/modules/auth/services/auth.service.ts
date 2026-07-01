import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { hash, verify } from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import ms from 'ms';
import { IS_DEV_NODE, isDev } from 'src/common/utils/is-dev';
import { JwtPayload } from '../interfaces';
import { User } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { UsersService } from 'src/modules/users/users.service';
import { MetricsService } from '../../../infra/metrics/metrics.service';
import { TokenService } from './token.service';
import { RefreshService } from './refresh.service';
import { SocialService } from './social.service';
import { VkIdAuthDto } from '../dtos/vk-id.auth.dto';

@Injectable()
export class AuthService {
  private readonly ACCESS_EXPIRES: number;
  private readonly REFRESH_EXPIRES: number;
  private readonly COOKIE_DOMAIN: string;

  private readonly VK_CLIENT_ID: string;
  private readonly VK_CLIENT_SECRET: string;
  private readonly VK_REDIRECT_URI: string;
  private readonly VK_GRANT_TYPE: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly usersService: UsersService,
    private readonly metrics: MetricsService,
    private readonly tokenService: TokenService,
    private readonly refreshService: RefreshService,
    private readonly socialService: SocialService,
  ) {
    this.ACCESS_EXPIRES = ms(config.getOrThrow<ms.StringValue>('JWT_EXPIRES_ACCESS_TOKEN'));
    this.REFRESH_EXPIRES = ms(config.getOrThrow<ms.StringValue>('JWT_EXPIRES_REFRESH_TOKEN'));
    this.COOKIE_DOMAIN = config.getOrThrow<string>('COOKIES_DOMAIN');

    this.VK_CLIENT_ID = config.getOrThrow<string>('VK_CLIENT_ID');
    this.VK_CLIENT_SECRET = config.getOrThrow<string>('VK_CLIENT_SECRET');
    this.VK_GRANT_TYPE = config.getOrThrow<string>('VK_GRANT_TYPE');
    this.VK_REDIRECT_URI = config.getOrThrow<string>('VK_REDIRECT_URI');
  }

  async register(dto: RegisterDto, req: Request, res: Response) {
    const { email, password, firstName, lastName } = dto;

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Пользователь уже существует');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await hash(password),
        firstName,
        lastName,
      },
    });

    try {
      this.metrics.recordLogin('register');
    } catch {}

    return this.issueTokens(user, req, res);
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.password) {
      try {
        this.metrics.recordLoginFailure('password', 'no_password');
      } catch {}
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const valid = await verify(user.password, dto.password);
    if (!valid) {
      try {
        this.metrics.recordLoginFailure('password', 'invalid_credentials');
      } catch {}

      throw new UnauthorizedException('Неверный логин или пароль');
    }

    try {
      this.metrics.recordLogin('password');
    } catch {}

    return this.issueTokens(user, req, res);
  }

  async refresh(req: Request, res: Response) {
    return this.refreshService.refresh(req, res);
  }

  /* ========================== LOGOUT ========================== */

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.clearCookie('refreshToken', { path: '/' });
      return;
    }

    const user = req.user;

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });

    for (const token of tokens) {
      if (await verify(token.tokenHash, refreshToken)) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
      path: '/',
      ...(IS_DEV_NODE ? {} : { domain: this.COOKIE_DOMAIN }),
    });

    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /* ========================== VK AUTH ========================== */

  async vkExchange(dto: VkIdAuthDto, req: Request, res: Response) {
    return this.socialService.vkExchange(dto, req, res);
  }

  private async issueTokens(user: User, req: Request, res: Response) {
    return this.tokenService.issueTokens(user, req, res);
  }

  private async generateTokens(user: User, req: Request) {
    const payload: JwtPayload = { id: user.id };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.ACCESS_EXPIRES,
    });

    const refreshToken = this.jwt.sign(payload, {
      expiresIn: this.REFRESH_EXPIRES,
    });

    let userDevice = await this.prisma.userDevice.findFirst({
      where: {
        userId: user.id,
        userAgent: req.headers['user-agent'],
      },
    });

    if (!userDevice) {
      userDevice = await this.prisma.userDevice.create({
        data: {
          userId: user.id,
          userAgent: req.headers['user-agent'] as string,
          ip: req.ip,
        },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        userDeviceId: userDevice.id,
        tokenHash: await hash(refreshToken),
        expiresAt: new Date(Date.now() + this.REFRESH_EXPIRES),
        deviceInfo: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    try {
      this.metrics.recordAuthTokenDuration(this.ACCESS_EXPIRES / 1000, 'access');
      this.metrics.recordAuthTokenDuration(this.REFRESH_EXPIRES / 1000, 'refresh');
    } catch {}

    return {
      accessToken,
      refreshToken,
      accessMaxAge: this.ACCESS_EXPIRES,
      refreshMaxAge: this.REFRESH_EXPIRES,
    };
  }

  private setRefreshCookie(res: Response, token: string, maxAge: number) {
    this.tokenService.setRefreshCookie(res, token, maxAge);
  }

  private async findRefreshToken(tokens: any[], token: string) {
    return this.tokenService.findRefreshToken(tokens, token);
  }
}
