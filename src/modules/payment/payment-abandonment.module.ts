import { Module } from '@nestjs/common';
import { BookingMetricsModule } from '../bookings/metrics/booking-metrics.module';
import { BookingPaymentLifecycleModule } from '../bookings/booking-payment-lifecycle.module';
import { PaymentProvidersModule } from './payment-providers.module';
import { PaymentAbandonmentService } from './services/payment-abandonment.service';

@Module({
  imports: [PaymentProvidersModule, BookingPaymentLifecycleModule, BookingMetricsModule],
  providers: [PaymentAbandonmentService],
  exports: [PaymentAbandonmentService],
})
export class PaymentAbandonmentModule {}
