import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { hash } from 'argon2';
import { EmailTokenPurpose, RevokedReason } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { API_V1, createE2eApp } from '../../../test/e2e-app.util';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from 'src/common/constants/csrf.constants';
import { getJwtAccessSecret, getJwtRefreshSecret } from 'src/config/jwt-secrets';
import { ConfigService } from '@nestjs/config';
import { EmailTokenService } from 'src/modules/auth/services/email-token.service';

jest.setTimeout(120_000);

function extractCookie(setCookie: string[] | string | undefined, name: string): string | undefined {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0];
}

/** JWT `iat` is second-precision — avoid identical login/refresh tokens in fast e2e. */
function waitForNextJwtSecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

describe('Auth — E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  let emailTokens: EmailTokenService;

  beforeAll(async () => {
    const bootstrapped = await createE2eApp();
    app = bootstrapped.app;
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);
    emailTokens = app.get(EmailTokenService);
  }, 60_000);

  afterEach(async () => {
    await prisma.emailToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userDevice.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string, password = 'password123') {
    const res = await request(app.getHttpServer())
      .post(`${API_V1}/auth/login`)
      .send({ email, password })
      .expect(201);

    const refreshCookie = extractCookie(res.headers['set-cookie'], 'refreshToken');
    const csrfCookie = extractCookie(res.headers['set-cookie'], CSRF_COOKIE_NAME);

    return {
      accessToken: res.body.accessToken as string,
      csrfToken: res.body.csrfToken as string,
      refreshCookie: refreshCookie!,
      csrfCookie: csrfCookie!,
    };
  }

  describe('POST /auth/register', () => {
    it('should register user successfully and return access token + csrf', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API_V1}/auth/register`)
        .send({
          email: 'test@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('csrfToken');
      expect(res.body.accessMaxAge).toBeGreaterThan(0);
      expect(res.body.accessToken).toMatch(/^eyJ/);

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(extractCookie(setCookie, 'refreshToken')).toBeDefined();
      expect(extractCookie(setCookie, CSRF_COOKIE_NAME)).toBeDefined();

      const savedUser = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(savedUser).toBeDefined();

      const savedRefresh = await prisma.refreshToken.findFirst({
        where: { userId: savedUser!.id },
      });
      expect(savedRefresh).not.toBeNull();
      expect(savedRefresh?.revokedAt).toBeNull();
    });

    it('should return 409 when user already exists', async () => {
      await prisma.user.create({
        data: {
          email: 'a@a.com',
          password: 'hashed',
          firstName: 'X',
          lastName: 'Y',
        },
      });

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/register`)
        .send({
          email: 'a@a.com',
          password: 'Password123',
          firstName: 'Max',
          lastName: 'Test',
        })
        .expect(409);
    });
  });

  describe('POST /auth/login + refresh + logout', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email: 'user@test.com',
          password: await hash('password123'),
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const session = await loginAs('user@test.com');
      expect(session.accessToken).toMatch(/^eyJ/);
      expect(session.csrfToken).toBeTruthy();
    });

    it('should reject refresh without CSRF', async () => {
      const session = await loginAs('user@test.com');

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/refresh`)
        .set('Cookie', session.refreshCookie)
        .expect(403);
    });

    it('should refresh token successfully with CSRF', async () => {
      const session = await loginAs('user@test.com');
      await waitForNextJwtSecond();

      const res = await request(app.getHttpServer())
        .post(`${API_V1}/auth/refresh`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.accessToken).not.toBe(session.accessToken);
      expect(res.body.csrfToken).toBeDefined();

      const newRefreshCookie = extractCookie(res.headers['set-cookie'], 'refreshToken');
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toBe(session.refreshCookie);

      const rotated = await prisma.refreshToken.findMany({
        where: { revokedReason: RevokedReason.REFRESH_ROTATION },
      });
      expect(rotated.length).toBe(1);
      expect(rotated[0].replacedById).toBeTruthy();
    });

    it('should detect refresh token reuse', async () => {
      const session = await loginAs('user@test.com');
      await waitForNextJwtSecond();

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/refresh`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/refresh`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .expect(401);

      const active = await prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(active).toBe(0);

      const replay = await prisma.refreshToken.count({
        where: { revokedReason: RevokedReason.REPLAY_ATTACK },
      });
      expect(replay).toBeGreaterThan(0);
    });

    it('should reject refresh JWT used as Bearer access token', async () => {
      const session = await loginAs('user@test.com');
      const refreshJwt = decodeURIComponent(session.refreshCookie.split('=')[1]);

      await request(app.getHttpServer())
        .get(`${API_V1}/users/me`)
        .set('Authorization', `Bearer ${refreshJwt}`)
        .expect(401);
    });

    it('should reject refresh cookie signed with access secret', async () => {
      const session = await loginAs('user@test.com');
      const decoded = jwt.decode(session.accessToken);
      const forgedRefresh = jwt.sign(
        { id: decoded.id, typ: 'refresh' },
        {
          secret: getJwtAccessSecret(config),
          expiresIn: '1h',
        },
      );

      const csrf = await request(app.getHttpServer()).get(`${API_V1}/auth/csrf`).expect(200);
      const csrfCookie = extractCookie(csrf.headers['set-cookie'], CSRF_COOKIE_NAME)!;

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/refresh`)
        .set('Cookie', `refreshToken=${forgedRefresh}; ${csrfCookie}`)
        .set(CSRF_HEADER_NAME, csrf.body.csrfToken)
        .expect(401);
    });

    it('should logout with bearer + csrf and revoke refresh', async () => {
      const session = await loginAs('user@test.com');

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/logout`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .expect(201);

      const active = await prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(active).toBe(0);

      const loggedOut = await prisma.refreshToken.findFirst({
        where: { revokedReason: RevokedReason.LOGOUT },
      });
      expect(loggedOut).not.toBeNull();
    });
  });

  describe('Token / device hygiene', () => {
    it('should track device info and reuse device by user-agent', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'device@test.com',
          password: await hash('password123'),
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const userAgent = 'test-agent-123';

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .set('User-Agent', userAgent)
        .send({ email: 'device@test.com', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .set('User-Agent', userAgent)
        .send({ email: 'device@test.com', password: 'password123' })
        .expect(201);

      const devices = await prisma.userDevice.findMany({ where: { userId: user.id } });
      expect(devices).toHaveLength(1);
    });

    it('access and refresh secrets can differ', () => {
      expect(getJwtAccessSecret(config)).toBeTruthy();
      expect(getJwtRefreshSecret(config)).toBeTruthy();
    });
  });

  describe('Email verification', () => {
    it('should confirm email verification token', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'verify@test.com',
          password: await hash('Password123'),
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const token = await emailTokens.issue(user.id, EmailTokenPurpose.EMAIL_VERIFY, 3_600_000);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/email/verify/confirm`)
        .send({ token })
        .expect(201);

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.emailVerifiedAt).not.toBeNull();
    });
  });

  describe('Password lifecycle', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email: 'pwd@test.com',
          password: await hash('Password123'),
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });

    it('forgot password always returns ok', async () => {
      await request(app.getHttpServer())
        .post(`${API_V1}/auth/password/forgot`)
        .send({ email: 'pwd@test.com' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/password/forgot`)
        .send({ email: 'missing@test.com' })
        .expect(201);
    });

    it('should reset password and revoke sessions', async () => {
      const session = await loginAs('pwd@test.com', 'Password123');
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'pwd@test.com' } });
      const token = await emailTokens.issue(user.id, EmailTokenPurpose.PASSWORD_RESET, 3_600_000);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/password/reset`)
        .send({ token, newPassword: 'NewPassword456' })
        .expect(201);

      const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .send({ email: 'pwd@test.com', password: 'NewPassword456' })
        .expect(201);

      expect(session.accessToken).toBeTruthy();
    });

    it('should change password while authenticated', async () => {
      const session = await loginAs('pwd@test.com', 'Password123');

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/password/change`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .send({ currentPassword: 'Password123', newPassword: 'ChangedPassword789' })
        .expect(201);

      const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .send({ email: 'pwd@test.com', password: 'ChangedPassword789' })
        .expect(201);
    });
  });

  describe('Sessions API', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email: 'sessions@test.com',
          password: await hash('Password123'),
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });

    it('should list sessions and revoke one device', async () => {
      const sessionA = await loginAs('sessions@test.com', 'Password123');

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .set('User-Agent', 'other-device')
        .send({ email: 'sessions@test.com', password: 'Password123' })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get(`${API_V1}/auth/sessions`)
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .set('Cookie', sessionA.refreshCookie)
        .expect(200);

      expect(listRes.body.sessions.length).toBeGreaterThanOrEqual(2);
      const otherSession = listRes.body.sessions.find((s: { current: boolean }) => !s.current);
      expect(otherSession).toBeDefined();

      await request(app.getHttpServer())
        .delete(`${API_V1}/auth/sessions/${otherSession.id}`)
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .set('Cookie', `${sessionA.refreshCookie}; ${sessionA.csrfCookie}`)
        .set(CSRF_HEADER_NAME, sessionA.csrfToken)
        .expect(200);
    });

    it('should logout from all devices', async () => {
      const session = await loginAs('sessions@test.com', 'Password123');

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/login`)
        .set('User-Agent', 'second-device')
        .send({ email: 'sessions@test.com', password: 'Password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${API_V1}/auth/logout-all`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('Cookie', `${session.refreshCookie}; ${session.csrfCookie}`)
        .set(CSRF_HEADER_NAME, session.csrfToken)
        .expect(201);

      const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });
  });
});
