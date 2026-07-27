import { Body, Controller, Delete, Get, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { AuthResponseDto } from '../dtos/auth.response.dto';
import { VkIdAuthDto } from '../dtos/vk-id.auth.dto';
import { VkPrepareDto } from '../dtos/vk-prepare.dto';
import { CsrfResponseDto } from '../dtos/csrf.response.dto';
import { ConfirmEmailDto } from '../dtos/confirm-email.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { OkResponseDto } from '../dtos/ok.response.dto';
import {
  RevokeSessionResponseDto,
  SessionsListResponseDto,
} from '../dtos/session.response.dto';
import type { Request, Response } from 'express';
import {
  Authorized,
  CsrfProtected,
  Protected,
  RateLimit,
  RATE_LIMIT_PRESETS,
} from 'src/common/decorators';
import { SWAGGER_BEARER_AUTH, SWAGGER_REFRESH_COOKIE_AUTH } from 'src/config/swagger-auth';
import {
  ApiBadRequestError,
  ApiCsrfHeader,
  ApiUserAuthErrors,
  SuccessResponseDto,
} from 'src/common/swagger/api-responses.decorator';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { SocialService } from '../services/social.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordLifecycleService } from '../services/password-lifecycle.service';
import { SessionsService } from '../services/sessions.service';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialService: SocialService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordLifecycle: PasswordLifecycleService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Get('csrf')
  @RateLimit(RATE_LIMIT_PRESETS.authRefresh)
  @ApiOperation({
    summary: 'Issue CSRF token',
    description:
      'Sets XSRF-TOKEN cookie and returns csrfToken for cookie-authenticated mutating requests.',
  })
  @ApiOkResponse({ type: CsrfResponseDto })
  issueCsrf(@Res({ passthrough: true }) res: Response): CsrfResponseDto {
    return this.authService.issueCsrf(res);
  }

  @Post('register')
  @RateLimit(RATE_LIMIT_PRESETS.authRegister)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Returns accessToken in the response body and sets refreshToken in an HttpOnly cookie. Sends a verification email.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestError()
  @ApiConflictResponse({
    description: 'A user with this email already exists',
    type: ErrorResponseDto,
  })
  async register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, req, res);
  }

  @Post('login')
  @RateLimit(RATE_LIMIT_PRESETS.authLogin)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestError()
  @ApiUnauthorizedResponse({ description: 'Invalid credentials', type: ErrorResponseDto })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, req, res);
  }

  @Post('vk/prepare')
  @RateLimit(RATE_LIMIT_PRESETS.authVk)
  @ApiOperation({ summary: 'Prepare VK OAuth state' })
  @ApiBody({ type: VkPrepareDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or reused OAuth state', type: ErrorResponseDto })
  async vkPrepare(@Body() dto: VkPrepareDto): Promise<OkResponseDto> {
    return this.socialService.prepareVkState(dto.state);
  }

  @Post('vk/exchange')
  @RateLimit(RATE_LIMIT_PRESETS.authVk)
  @ApiOperation({ summary: 'Login via VK ID' })
  @ApiBody({ type: VkIdAuthDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid OAuth state or VK authorization failed',
    type: ErrorResponseDto,
  })
  async vkExchange(
    @Body() dto: VkIdAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.vkExchange(dto, req, res);
  }

  @Post('email/verify/confirm')
  @RateLimit(RATE_LIMIT_PRESETS.authVerify)
  @ApiOperation({ summary: 'Confirm email verification token' })
  @ApiBody({ type: ConfirmEmailDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token', type: ErrorResponseDto })
  async confirmEmail(@Body() dto: ConfirmEmailDto): Promise<OkResponseDto> {
    return this.emailVerification.confirm(dto.token);
  }

  @Protected()
  @Post('email/verify/resend')
  @RateLimit(RATE_LIMIT_PRESETS.authVerify)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUserAuthErrors()
  @ApiBadRequestResponse({ description: 'No email or send failed', type: ErrorResponseDto })
  async resendVerification(@Authorized('id') userId: string): Promise<OkResponseDto> {
    return this.emailVerification.sendForUser(userId);
  }

  @Post('password/forgot')
  @RateLimit(RATE_LIMIT_PRESETS.authForgotPassword)
  @ApiOperation({
    summary: 'Request password reset email',
    description: 'Always returns ok to avoid email enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiBadRequestError()
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<OkResponseDto> {
    return this.passwordLifecycle.forgotPassword(dto.email);
  }

  @Post('password/reset')
  @RateLimit(RATE_LIMIT_PRESETS.authResetPassword)
  @ApiOperation({ summary: 'Reset password with email token (revokes all sessions)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiBadRequestError()
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token', type: ErrorResponseDto })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OkResponseDto> {
    return this.passwordLifecycle.resetPassword(dto.token, dto.newPassword, res);
  }

  @Protected()
  @Post('password/change')
  @RateLimit(RATE_LIMIT_PRESETS.authResetPassword)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiOperation({
    summary: 'Change password while authenticated (revokes all sessions)',
    description:
      'Updates the password, revokes all refresh sessions, invalidates pending reset links, and clears the refresh cookie.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  async changePassword(
    @Authorized('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OkResponseDto> {
    return this.passwordLifecycle.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      res,
    );
  }

  @Post('refresh')
  @CsrfProtected()
  @RateLimit(RATE_LIMIT_PRESETS.authRefresh)
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiCsrfHeader()
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Uses refreshToken from the HttpOnly cookie. Requires x-xsrf-token matching XSRF-TOKEN cookie.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is missing or invalid',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Invalid CSRF token', type: ErrorResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return await this.authService.refresh(req, res);
  }

  @Protected()
  @Get('sessions')
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiOperation({
    summary: 'List active sessions',
    description: 'Returns non-revoked, non-expired refresh sessions. Marks the current cookie session.',
  })
  @ApiOkResponse({ type: SessionsListResponseDto })
  @ApiUserAuthErrors()
  async listSessions(
    @Authorized('id') userId: string,
    @Req() req: Request,
  ): Promise<SessionsListResponseDto> {
    return this.sessionsService.listSessions(userId, req);
  }

  @Protected()
  @CsrfProtected()
  @Delete('sessions/:id')
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiCsrfHeader()
  @ApiParam({ name: 'id', description: 'Session (refresh token) id' })
  @ApiOperation({ summary: 'Revoke one session/device' })
  @ApiOkResponse({ type: RevokeSessionResponseDto })
  @ApiUserAuthErrors()
  @ApiNotFoundResponse({ description: 'Session not found', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Invalid CSRF token', type: ErrorResponseDto })
  async revokeSession(
    @Authorized('id') userId: string,
    @Param('id') sessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RevokeSessionResponseDto> {
    return this.sessionsService.revokeSession(userId, sessionId, req, res);
  }

  @Protected()
  @CsrfProtected()
  @Post('logout-all')
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiCsrfHeader()
  @ApiOperation({ summary: 'Revoke all sessions for the current user' })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUserAuthErrors()
  @ApiForbiddenResponse({ description: 'Invalid CSRF token', type: ErrorResponseDto })
  async logoutAll(
    @Authorized('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OkResponseDto> {
    return this.sessionsService.logoutAll(userId, res);
  }

  @CsrfProtected()
  @Post('logout')
  @ApiCookieAuth(SWAGGER_REFRESH_COOKIE_AUTH)
  @ApiCsrfHeader()
  @ApiOperation({ summary: 'Log out the user from the current device' })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiForbiddenResponse({ description: 'Invalid CSRF token', type: ErrorResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SuccessResponseDto> {
    return this.authService.logout(req, res);
  }
}
