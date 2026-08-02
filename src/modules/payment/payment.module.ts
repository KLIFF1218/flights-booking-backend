import { Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentCoreModule } from './payment-core.module';
import { PaymentAbandonmentModule } from './payment-abandonment.module';
import { PaymentOutboxHandlersModule } from './payment-outbox-handlers.module';
import { WebhookModule } from './webhook/webhook.module';
import { MailModule } from 'src/infra/mail/mail.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { RabbitmqModule } from 'src/infra/rabbitmq/rabbitmq.module';
import { BookingExpirationModule } from '../bookings/booking-expiration.module';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  imports: [
    PaymentCoreModule,
    PaymentAbandonmentModule,
    PaymentOutboxHandlersModule,
    WebhookModule,
    MailModule,
    TicketingModule,
    S3Module,
    RabbitmqModule,
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
