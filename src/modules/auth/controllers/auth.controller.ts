import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { AuthResponseDto } from '../dtos/auth.response.dto';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: Logger,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiBody({
    type: RegisterDto,
    description: 'Данные для регистрации пользователя',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Пользователь успешно зарегистрирован. Возвращает accessToken',
  })
  @ApiBadRequestResponse({
    description: 'Ошибка валидации входных данных (неверный email, короткий пароль и т.д.)',
  })
  @ApiConflictResponse({
    description: 'Пользователь с таким email уже существует',
  })
  async register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, req, res);
  }

  @Post('login')
  @ApiOperation({ summary: 'Авторизация пользователя' })
  @ApiBody({
    type: LoginDto,
    description: 'Данные для авторизации пользователя',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Пользователь успешно авторизован. Возвращает accessToken',
  })
  @ApiBadRequestResponse({
    description: 'Ошибка валидации входных данных (неверный формат email и т.д.)',
  })
  @ApiNotFoundResponse({
    description: 'Неверный email или пароль',
  })
  @ApiUnauthorizedResponse({
    description: 'Ошибка авторизации, неверные данные или отсутствует токен',
  })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, req, res);
  }

  @Post('vk/exchange')
  async vkExchange(
    @Body() dto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.vkExchange(dto, req, res);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return await this.authService.refresh(req, res);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Выход пользователя из текущего устройства' })
  @ApiOkResponse({ description: 'Пользователь успешно вышел' })
  @ApiUnauthorizedResponse({ description: 'Refresh token отсутствует или невалиден' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(req, res);
  }
}
