import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { PaymentCoreModule } from '../payment-core.module';

@Module({
  imports: [PaymentCoreModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
