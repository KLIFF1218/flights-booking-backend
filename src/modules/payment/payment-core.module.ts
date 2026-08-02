import { Module } from '@nestjs/common';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { BookingPaymentLifecycleModule } from '../bookings/booking-payment-lifecycle.module';
import { PaymentAbandonmentModule } from './payment-abandonment.module';
import { PaymentProvidersModule } from './payment-providers.module';
import { PaymentHandler } from './payment.handler';
import { IdempotencyService } from './services/idempotency.service';
import { AuthorizePaymentUseCase } from './use-cases/authorize-payment.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { FailPaymentUseCase } from './use-cases/fail-payment.use-case';
import { ReconcileLateSuccessUseCase } from './use-cases/reconcile-late-success.use-case';

@Module({
  imports: [
    PaymentProvidersModule,
    PaymentAbandonmentModule,
    BookingPaymentLifecycleModule,
    OutboxModule,
  ],
  providers: [
    PaymentHandler,
    IdempotencyService,
    AuthorizePaymentUseCase,
    ConfirmPaymentUseCase,
    FailPaymentUseCase,
    ReconcileLateSuccessUseCase,
  ],
  exports: [PaymentHandler, PaymentAbandonmentModule, PaymentProvidersModule],
})
export class PaymentCoreModule {}
