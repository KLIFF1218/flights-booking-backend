import { Module } from '@nestjs/common';
import { PaymentAbandonmentModule } from './payment-abandonment.module';
import { PaymentPendingRollbackService } from './services/payment-pending-rollback.service';

@Module({
  imports: [PaymentAbandonmentModule],
  providers: [PaymentPendingRollbackService],
  exports: [PaymentPendingRollbackService],
})
export class PaymentPendingRollbackModule {}
