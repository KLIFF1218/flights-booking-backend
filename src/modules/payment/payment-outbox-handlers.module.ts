import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from './payment-providers.module';
import { PaymentPendingCancelOutboxHandler } from './handlers/payment-pending-cancel.outbox-handler';

@Module({
  imports: [PaymentProvidersModule],
  providers: [PaymentPendingCancelOutboxHandler],
  exports: [PaymentPendingCancelOutboxHandler],
})
export class PaymentOutboxHandlersModule {}
