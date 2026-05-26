import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
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
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy],
})
export class AuthModule {}
