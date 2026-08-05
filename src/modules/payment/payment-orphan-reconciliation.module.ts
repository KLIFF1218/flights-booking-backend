import { Module } from '@nestjs/common';
import { BookingMetricsModule } from '../bookings/metrics/booking-metrics.module';
import { PaymentPendingRollbackModule } from './payment-pending-rollback.module';
import { PaymentOrphanReconciliationService } from './services/payment-orphan-reconciliation.service';

@Module({
  imports: [PaymentPendingRollbackModule, BookingMetricsModule],
  providers: [PaymentOrphanReconciliationService],
  exports: [PaymentOrphanReconciliationService],
})
export class PaymentOrphanReconciliationModule {}
