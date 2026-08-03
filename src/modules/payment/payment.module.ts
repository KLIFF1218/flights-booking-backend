import { Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { PaymentTransactionQueryService } from './services/payment-transaction-query.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentCoreModule } from './payment-core.module';
import { PaymentAbandonmentModule } from './payment-abandonment.module';
import { PaymentOutboxHandlersModule } from './payment-outbox-handlers.module';
import { PaymentPendingRollbackModule } from './payment-pending-rollback.module';
import { WebhookModule } from './webhook/webhook.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { BookingExpirationModule } from '../bookings/booking-expiration.module';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PaymentTransactionQueryService],
  imports: [
    PaymentCoreModule,
    PaymentAbandonmentModule,
    PaymentPendingRollbackModule,
    PaymentOutboxHandlersModule,
    WebhookModule,
    S3Module,
    BookingExpirationModule,
  ],
  exports: [
    PaymentService,
    PaymentCoreModule,
    PaymentAbandonmentModule,
    PaymentOutboxHandlersModule,
  ],
})
export class PaymentsModule {}
