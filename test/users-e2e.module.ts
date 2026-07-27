import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdminUsersModule } from 'src/modules/admin/admin-users/admin-users.module';
import { UsersModule } from 'src/modules/users/users.module';

/**
 * Minimal module graph for users/admin-users e2e: auth + profile + admin users
 * without Kafka, BullMQ, scheduler, payments, or flights bootstrapping.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [currencyConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'silent',
        autoLogging: false,
      },
    }),
    PrismaModule,
    MetricsModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AdminUsersModule,
  ],
})
export class UsersE2eModule {}
