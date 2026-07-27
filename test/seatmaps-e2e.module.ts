import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { FlightsModule } from 'src/modules/flights/flights.module';
import { SeatMapModule } from 'src/modules/seatmaps/seatmap.module';

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
    FlightsModule,
    SeatMapModule,
  ],
})
export class SeatmapsE2eModule {}
