import { forwardRef, Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { YoomoneyModule } from '../providers/yoomoney/yoomoney.module';
import { PaymentsModule } from '../payment.module';
import { StripeModule } from '../providers/stripe/stripe.module';

@Module({
  imports: [YoomoneyModule, StripeModule, forwardRef(() => PaymentsModule)],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
