import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { RefreshService } from './services/refresh.service';
import { SocialService } from './services/social.service';
import { CsrfService } from './services/csrf.service';
import { PasswordService } from './services/password.service';
import { EmailTokenService } from './services/email-token.service';
import { AuthEmailService } from './services/auth-email.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordLifecycleService } from './services/password-lifecycle.service';
import { SessionsService } from './services/sessions.service';
import { AuthController } from './controllers/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getJwtConfig } from 'src/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    RefreshService,
    SocialService,
    CsrfService,
    PasswordService,
    EmailTokenService,
    AuthEmailService,
    EmailVerificationService,
    PasswordLifecycleService,
    SessionsService,
    JwtStrategy,
  ],
  exports: [EmailVerificationService, PasswordService, AuthService, SessionsService],
})
export class AuthModule {}
