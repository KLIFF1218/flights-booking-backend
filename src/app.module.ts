import { Module, Scope } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import currencyConfig from './config/currency.config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { LoggerModule } from 'nestjs-pino';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { BullModule } from '@nestjs/bullmq';

import { FlightsModule } from './modules/flights/flights.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payment/payment.module';
import { AirportsModule } from './modules/airports/airports.module';
import { SeatMapModule } from './modules/seatmaps/seatmap.module';
import { AuthModule } from './modules/auth/auth.module';

import { InfraModule } from './infra/infra.module';
import { MailModule } from './infra/mail/mail.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './health/health.module';

import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RateLimiterService } from './infra/rate-limiter/rate-limiter-redis.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

import { isDev } from './common/utils';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { AdminUsersModule } from './modules/admin/admin-users/admin-users.module';
import { UsersModule } from './modules/users/users.module';
import { AdminBookingsModule } from './modules/admin/admin-bookings/admin-bookings.module';
import { AdminPaymentsModule } from './modules/admin/admin-payments/admin-payments.module';
import { AdminDashboardModule } from './modules/admin/admin-dashboard/admin-dashboard.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AdminFlightsModule } from './modules/admin/admin-flights/admin-flights.module';
import { AdminAirportsModule } from './modules/admin/admin-airports/admin-airports.module';
import { AircraftsModule } from './modules/aircrafts/aircrafts.module';
import { AirlinesModule } from './modules/airlines/airlines.module';
import { MetricsModule } from './infra/metrics/metrics.module';
import { RabbitmqModule } from './infra/rabbitmq/rabbitmq.module';
import { KafkaModule } from './infra/kafka/kafka.module';
import { OutboxModule } from './infra/outbox/outbox.module';
import { LifecycleModule } from './infra/lifecycle/lifecycle.module';
import { validateEnv } from './config/env.validation';
import { AppValidationPipe } from './common/pipes/app-validation.pipe';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [currencyConfig],
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dev = isDev(config);

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', 'info'),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'body.password',
                'body.token',
                'body.refreshToken',
                'body.accessToken',
                '*.password',
                '*.token',
                '*.refreshToken',
                '*.accessToken',
              ],
              censor: '[REDACTED]',
            },

            transport: dev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,

            genReqId: (req) => {
              const request = req as {
                requestId?: string;
                headers: Record<string, string | string[] | undefined>;
              };
              if (request.requestId) {
                return request.requestId;
              }

              const header = request.headers['x-request-id'] ?? request.headers['x-correlation-id'];
              if (typeof header === 'string' && header.length > 0) {
                return header;
              }

              return crypto.randomUUID();
            },

            customProps: (req) => ({
              requestId: (req as { requestId?: string }).requestId ?? req.headers['x-request-id'],
            }),

            autoLogging: false,
          },
        };
      },
    }),

    SentryModule.forRoot(),

    InfraModule,
    RedisModule,
    RabbitmqModule,
    MailModule,
    KafkaModule,
    SchedulerModule,
    HealthModule,

    OutboxModule,
    LifecycleModule,

    // PrometheusModule.register({
    //   path: '/metrics',
    //   defaultMetrics: {
    //     enabled: true,
    //   },
    // }),
    MetricsModule,

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow('REDIS_PORT'),
          ...(config.get<string>('REDIS_PASSWORD')
            ? { password: config.get<string>('REDIS_PASSWORD') }
            : {}),
          tls: config.get('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),

    AuthModule,
    FlightsModule,
    BookingsModule,
    PaymentsModule,
    AirportsModule,
    SeatMapModule,
    TicketingModule,
    AdminUsersModule,
    UsersModule,
    AdminBookingsModule,
    AdminPaymentsModule,
    AdminDashboardModule,
    AdminFlightsModule,
    AdminAirportsModule,
    AircraftsModule,
    AirlinesModule,
  ],

  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    RateLimiterService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_PIPE,
      scope: Scope.REQUEST,
      useClass: AppValidationPipe,
    },
  ],
})
export class AppModule {}
