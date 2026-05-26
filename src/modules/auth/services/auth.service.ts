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
import axios from 'axios';
import { VkIdAuthDto } from '../dtos/vk-id.auth.dto';
import { ExchangeVkTokensInterface } from '../interfaces/exchange-vk-tokens.interface';
import crypto from 'crypto';

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

    return this.issueTokens(user, req, res);
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.password) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const valid = await verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    return this.issueTokens(user, req, res);
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token отсутствует');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token невалиден');
    }

    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const matched = await this.findRefreshToken(activeTokens, refreshToken);

    if (!matched) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.id },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException('Обнаружено повторное использование refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.getById(payload.id);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    const tokens = await this.generateTokens(user, req);

    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAge);

    return {
      accessToken: tokens.accessToken,
      accessMaxAge: tokens.accessMaxAge,
    };
  }

  /* ========================== LOGOUT ========================== */

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.clearCookie('refreshToken', { path: '/' });
      return;
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null },
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

  async exchangeVkCode(dto: VkIdAuthDto): Promise<ExchangeVkTokensInterface> {
    try {
      const { data } = await axios.post<ExchangeVkTokensInterface>(
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
    } catch (e: any) {
      this.logger.error(e?.response?.data, 'VK exchange failed');
      this.logger.error('error: ', e);
      throw new UnauthorizedException('VK authorization failed');
    }
  }

  async vkExchange(dto: VkIdAuthDto, req: Request, res: Response) {
    const vkTokens = await this.exchangeVkCode(dto);

    if (!vkTokens.access_token || !vkTokens.user_id) {
      throw new UnauthorizedException('VK tokens are invalid');
    }

    let userInfo: any;

    try {
      const { data } = await axios.get('https://id.vk.ru/oauth2/user_info', {
        params: {
          client_id: this.VK_CLIENT_ID,
        },
        headers: {
          Authorization: `Bearer ${vkTokens.access_token}`,
        },
      });

      userInfo = data.user;
    } catch (e: any) {
      this.logger.error(e?.response?.data, 'VK userInfo failed');
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
      const updateData: any = {};

      if (!user.firstName && firstName) updateData.firstName = firstName;
      if (!user.lastName && lastName) updateData.lastName = lastName;
      if (!user.email && email) updateData.email = email;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      return this.issueTokens(user, req, res);
    }

    if (email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        const updateData: any = {
          vkId,
        };

        if (!existingByEmail.firstName && firstName) updateData.firstName = firstName;

        if (!existingByEmail.lastName && lastName) updateData.lastName = lastName;

        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: updateData,
        });

        return this.issueTokens(user, req, res);
      }
    }

    user = await this.prisma.user.create({
      data: {
        vkId,
        email,
        firstName,
        lastName,
      },
    });

    return this.issueTokens(user, req, res);
  }


  private async issueTokens(user: User, req: Request, res: Response) {
    const tokens = await this.generateTokens(user, req);
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshMaxAge);

    return {
      accessToken: tokens.accessToken,
      accessMaxAge: tokens.accessMaxAge,
    };
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

    return {
      accessToken,
      refreshToken,
      accessMaxAge: this.ACCESS_EXPIRES,
      refreshMaxAge: this.REFRESH_EXPIRES,
    };
  }

  private setRefreshCookie(res: Response, token: string, maxAge: number) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
      path: '/',
      maxAge,
      ...(IS_DEV_NODE ? {} : { domain: this.COOKIE_DOMAIN }),
    });
  }

  private async findRefreshToken(tokens: any[], token: string) {
    for (const t of tokens) {
      if (await verify(t.tokenHash, token)) {
        return t;
      }
    }
    return null;
  }
}
