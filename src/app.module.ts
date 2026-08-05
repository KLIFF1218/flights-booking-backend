import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import currencyConfig from './config/currency.config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { LoggerModule } from 'nestjs-pino';
import { SentryModule } from '@sentry/nestjs/setup';
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
import { getLoggingConfig } from './config/logger.config';
import { redisConfig } from './config/redis.config';

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
      useFactory: getLoggingConfig,
    }),

    SentryModule.forRoot(),

    ScheduleModule.forRoot(),

    InfraModule,
    RedisModule,
    RabbitmqModule,
    MailModule,
    KafkaModule,
    SchedulerModule,
    HealthModule,

    OutboxModule,
    LifecycleModule,

    MetricsModule,

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          ...redisConfig(config),
          maxRetriesPerRequest: null,
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
      useClass: AppValidationPipe,
    },
  ],
})
export class AppModule {}
