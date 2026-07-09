import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

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
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RateLimiterService } from './infra/rate-limiter/rate-limiter-redis.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

import { isDev } from './common/utils';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { DebugModule } from './debug/debug.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dev = isDev(config);

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', 'info'),

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

            genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),

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
          password: config.get('REDIS_PASSWORD'),
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
    DebugModule,
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
  ],
})
export class AppModule {}
