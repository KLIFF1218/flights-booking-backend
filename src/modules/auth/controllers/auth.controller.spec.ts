import { Test, type TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth/auth.service';
import { SocialService } from '../services/social/social.service';
import { EmailVerificationService } from '../services/email/email-verification.service';
import { PasswordLifecycleService } from '../services/password/password-lifecycle.service';
import { SessionsService } from '../services/session/sessions.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    vkExchange: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    issueCsrf: jest.fn(),
  };

  const socialServiceMock = {
    prepareVkState: jest.fn(),
  };

  const emailVerificationMock = {
    confirm: jest.fn(),
    sendForUser: jest.fn(),
  };

  const passwordLifecycleMock = {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  const sessionsServiceMock = {
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
    logoutAll: jest.fn(),
  };

  const req = { headers: { 'user-agent': 'test-agent' }, ip: '1.1.1.1', cookies: {} } as any;
  const res = { cookie: jest.fn(), clearCookie: jest.fn() } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: SocialService, useValue: socialServiceMock },
        { provide: EmailVerificationService, useValue: emailVerificationMock },
        { provide: PasswordLifecycleService, useValue: passwordLifecycleMock },
        { provide: SessionsService, useValue: sessionsServiceMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('issueCsrf delegates to AuthService', () => {
    authServiceMock.issueCsrf.mockReturnValue({ csrfToken: 'csrf' });
    expect(controller.issueCsrf(res)).toEqual({ csrfToken: 'csrf' });
    expect(authServiceMock.issueCsrf).toHaveBeenCalledWith(res);
  });

  it('register should call authService.register', async () => {
    authServiceMock.register.mockResolvedValue({
      accessToken: 'token',
      accessMaxAge: 1000,
      csrfToken: 'csrf',
    });

    const dto = { email: 'a@a.com', password: '12345678', firstName: 'John', lastName: 'Doe' };
    const result = await controller.register(req, res, dto);

    expect(authServiceMock.register).toHaveBeenCalledWith(dto, req, res);
    expect(result).toEqual({ accessToken: 'token', accessMaxAge: 1000, csrfToken: 'csrf' });
  });

  it('login delegates to AuthService', async () => {
    authServiceMock.login.mockResolvedValue({ accessToken: 'token', accessMaxAge: 1000 });
    const dto = { email: 'a@a.com', password: '12345678' };

    await expect(controller.login(req, res, dto)).resolves.toEqual({
      accessToken: 'token',
      accessMaxAge: 1000,
    });
    expect(authServiceMock.login).toHaveBeenCalledWith(dto, req, res);
  });

  it('refresh delegates to AuthService', async () => {
    authServiceMock.refresh.mockResolvedValue({ accessToken: 'new', accessMaxAge: 1000 });
    await expect(controller.refresh(req, res)).resolves.toEqual({
      accessToken: 'new',
      accessMaxAge: 1000,
    });
  });

  it('logout delegates to AuthService', async () => {
    authServiceMock.logout.mockResolvedValue({ success: true });
    await expect(controller.logout(req, res)).resolves.toEqual({ success: true });
  });

  it('vkPrepare delegates to SocialService', async () => {
    socialServiceMock.prepareVkState.mockResolvedValue({ ok: true });
    await expect(controller.vkPrepare({ state: 'state-1' })).resolves.toEqual({ ok: true });
    expect(socialServiceMock.prepareVkState).toHaveBeenCalledWith('state-1');
  });

  it('vkExchange delegates to AuthService', async () => {
    const dto = { code: 'c', device_id: 'd', code_verifier: 'v', state: 's' } as any;
    authServiceMock.vkExchange.mockResolvedValue({ accessToken: 'token', accessMaxAge: 1000 });
    await controller.vkExchange(dto, req, res);
    expect(authServiceMock.vkExchange).toHaveBeenCalledWith(dto, req, res);
  });

  it('confirmEmail delegates to EmailVerificationService', async () => {
    emailVerificationMock.confirm.mockResolvedValue({ ok: true });
    await expect(controller.confirmEmail({ token: 'token-value-123456' })).resolves.toEqual({
      ok: true,
    });
  });

  it('resendVerification delegates to EmailVerificationService', async () => {
    emailVerificationMock.sendForUser.mockResolvedValue({ ok: true });
    await expect(controller.resendVerification('user-1')).resolves.toEqual({ ok: true });
  });

  it('forgotPassword delegates to PasswordLifecycleService', async () => {
    passwordLifecycleMock.forgotPassword.mockResolvedValue({ ok: true });
    await expect(controller.forgotPassword({ email: 'a@a.com' })).resolves.toEqual({ ok: true });
  });

  it('resetPassword delegates to PasswordLifecycleService', async () => {
    passwordLifecycleMock.resetPassword.mockResolvedValue({ ok: true });
    await expect(
      controller.resetPassword({ token: 't', newPassword: 'Password123' }, res),
    ).resolves.toEqual({ ok: true });
  });

  it('changePassword delegates to PasswordLifecycleService', async () => {
    passwordLifecycleMock.changePassword.mockResolvedValue({ ok: true });
    await expect(
      controller.changePassword(
        'user-1',
        { currentPassword: 'oldpass12', newPassword: 'newpass12' },
        res,
      ),
    ).resolves.toEqual({ ok: true });
  });

  it('listSessions delegates to SessionsService', async () => {
    sessionsServiceMock.listSessions.mockResolvedValue({ sessions: [] });
    await expect(controller.listSessions('user-1', req)).resolves.toEqual({ sessions: [] });
    expect(sessionsServiceMock.listSessions).toHaveBeenCalledWith('user-1', req);
  });

  it('logoutAll delegates to SessionsService', async () => {
    sessionsServiceMock.logoutAll.mockResolvedValue({ ok: true });
    await expect(controller.logoutAll('user-1', res)).resolves.toEqual({ ok: true });
    expect(sessionsServiceMock.logoutAll).toHaveBeenCalledWith('user-1', res);
  });

  it('revokeSession delegates to SessionsService', async () => {
    sessionsServiceMock.revokeSession.mockResolvedValue({ ok: true, revokedCurrent: false });
    await expect(controller.revokeSession('user-1', 'rt-1', req, res)).resolves.toEqual({
      ok: true,
      revokedCurrent: false,
    });
  });
});
