import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { AirportsController } from 'src/modules/airports/controllers/airports.controller';
import { AirportsService } from 'src/modules/airports/services/airports.service';

/**
 * Minimal module graph for airports search e2e (public GET /airports/search only).
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
  ],
  controllers: [AirportsController],
  providers: [AirportsService],
})
export class AirportsE2eModule {}
