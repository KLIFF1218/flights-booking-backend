import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { BookingsCacheModule } from 'src/modules/bookings/bookings-cache.module';
import { SeatReleaseModule } from 'src/modules/bookings/seat-release.module';
import { PaymentController } from 'src/modules/payment/controllers/payment.controller';
import { PaymentService } from 'src/modules/payment/services/payment.service';
import { PaymentHandler } from 'src/modules/payment/payment.handler';
import { IdempotencyService } from 'src/modules/payment/services/idempotency.service';
import { PaymentProviderService } from 'src/modules/payment/services/payment-provider.service';
import { PaymentAbandonmentService } from 'src/modules/payment/services/payment-abandonment.service';
import { WebhookController } from 'src/modules/payment/webhook/webhook.controller';
import { WebhookService } from 'src/modules/payment/webhook/webhook.service';
import { YookassaProvider } from 'src/modules/payment/providers/yoomoney/yoomoney.service';
import { StripeService } from 'src/modules/payment/providers/stripe/stripe.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { OutboxE2eModule } from './outbox-e2e.module';
import { BookingExpirationE2eModule } from './booking-expiration-e2e.module';
import {
  createE2ePaymentAbandonmentStub,
  createE2ePaymentProviderStub,
  createE2eStripeWebhookStub,
  createE2eYookassaWebhookStub,
  s3E2eStub,
} from './e2e-payment.stubs';

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
    BookingMetricsModule,
    BookingsCacheModule,
    SeatReleaseModule,
    OutboxE2eModule,
    BookingExpirationE2eModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [
    PaymentService,
    PaymentHandler,
    IdempotencyService,
    WebhookService,
    { provide: PaymentProviderService, useValue: createE2ePaymentProviderStub() },
    { provide: PaymentAbandonmentService, useValue: createE2ePaymentAbandonmentStub() },
    { provide: YookassaProvider, useValue: createE2eYookassaWebhookStub() },
    { provide: StripeService, useValue: createE2eStripeWebhookStub() },
    { provide: S3Service, useValue: s3E2eStub },
  ],
})
export class PaymentE2eModule {}
