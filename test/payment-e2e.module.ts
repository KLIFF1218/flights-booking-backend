import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PaymentController } from 'src/modules/payment/controllers/payment.controller';
import { PaymentHandler } from 'src/modules/payment/handlers/payment.handler';
import { IdempotencyService } from 'src/modules/payment/services/idempotency.service';
import { PaymentProviderService } from 'src/modules/payment/services/payment-provider.service';
import { PaymentAbandonmentService } from 'src/modules/payment/services/payment-abandonment.service';
import { PaymentTransactionQueryService } from 'src/modules/payment/services/payment-transaction-query.service';
import { WebhookController } from 'src/modules/payment/webhook/webhook.controller';
import { WebhookService } from 'src/modules/payment/webhook/webhook.service';
import { AuthorizePaymentUseCase } from 'src/modules/payment/use-cases/authorize-payment.use-case';
import { ConfirmPaymentUseCase } from 'src/modules/payment/use-cases/confirm-payment.use-case';
import { FailPaymentUseCase } from 'src/modules/payment/use-cases/fail-payment.use-case';
import { ReconcileLateSuccessUseCase } from 'src/modules/payment/use-cases/reconcile-late-success.use-case';
import { S3Service } from 'src/infra/storage/s3.service';
import { OutboxE2eModule } from './outbox-e2e.module';
import { BookingExpirationE2eModule } from './booking-expiration-e2e.module';
import { BookingPaymentLifecycleE2eModule } from './booking-payment-lifecycle-e2e.module';
import { PaymentsE2eModule } from './payments-e2e.module';
import {
  createE2ePaymentAbandonmentStub,
  createE2ePaymentProviderStub,
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
    OutboxE2eModule,
    BookingPaymentLifecycleE2eModule,
    BookingExpirationE2eModule,
    PaymentsE2eModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [
    PaymentTransactionQueryService,
    PaymentHandler,
    IdempotencyService,
    AuthorizePaymentUseCase,
    ConfirmPaymentUseCase,
    FailPaymentUseCase,
    ReconcileLateSuccessUseCase,
    WebhookService,
    { provide: PaymentProviderService, useValue: createE2ePaymentProviderStub() },
    { provide: PaymentAbandonmentService, useValue: createE2ePaymentAbandonmentStub() },
    { provide: S3Service, useValue: s3E2eStub },
  ],
})
export class PaymentE2eModule {}
