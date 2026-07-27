import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AircraftsModule } from 'src/modules/aircrafts/aircrafts.module';
import { UsersModule } from 'src/modules/users/users.module';

/**
 * Minimal module graph for aircrafts e2e: auth + GET /aircrafts list.
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
    UsersModule,
    AuthModule,
    AircraftsModule,
  ],
})
export class AircraftsE2eModule {}
