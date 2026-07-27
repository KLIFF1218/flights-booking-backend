import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/users.module';
import { AdminDashboardModule } from 'src/modules/admin/admin-dashboard/admin-dashboard.module';
import { AdminBookingsModule } from 'src/modules/admin/admin-bookings/admin-bookings.module';
import { AdminAirportsModule } from 'src/modules/admin/admin-airports/admin-airports.module';

/**
 * Slim admin e2e: auth + dashboard + bookings + airports.
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
    AdminDashboardModule,
    AdminBookingsModule,
    AdminAirportsModule,
  ],
})
export class AdminE2eModule {}
