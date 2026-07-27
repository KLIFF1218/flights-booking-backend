import { forwardRef, Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { PaymentAbandonmentService } from './services/payment-abandonment.service';
import { PaymentController } from './controllers/payment.controller';
import { YoomoneyModule } from './providers/yoomoney/yoomoney.module';
import { StripeModule } from './providers/stripe/stripe.module';
import { WebhookModule } from './webhook/webhook.module';
import { PaymentHandler } from './payment.handler';
import { PaymentPendingCancelOutboxHandler } from './handlers/payment-pending-cancel.outbox-handler';
import { MailModule } from 'src/infra/mail/mail.module';
import { PaymentProviderService } from './services/payment-provider.service';
import { TicketingModule } from '../ticketing/ticketing.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { RabbitmqModule } from 'src/infra/rabbitmq/rabbitmq.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { IdempotencyService } from './services/idempotency.service';
import { SeatReleaseModule } from '../bookings/seat-release.module';
import { BookingsCacheModule } from '../bookings/bookings-cache.module';
import { BookingExpirationModule } from '../bookings/booking-expiration.module';

@Module({
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentAbandonmentService,
    PaymentHandler,
    PaymentPendingCancelOutboxHandler,
    PaymentProviderService,
    IdempotencyService,
  ],
  imports: [
    YoomoneyModule,
    StripeModule,
    forwardRef(() => WebhookModule),
    MailModule,
    TicketingModule,
    S3Module,
    RabbitmqModule,
    forwardRef(() => OutboxModule),
    SeatReleaseModule,
    BookingsCacheModule,
    BookingExpirationModule,
  ],
  exports: [
    PaymentService,
    PaymentHandler,
    PaymentAbandonmentService,
    PaymentPendingCancelOutboxHandler,
  ],
})
export class PaymentsModule {}
