import { Module } from '@nestjs/common';
import { YoomoneyModule } from './providers/yoomoney/yoomoney.module';
import { StripeModule } from './providers/stripe/stripe.module';
import { PaymentProviderService } from './services/payment-provider.service';
import { PaymentProviderRegistry } from './services/payment-provider.registry';

@Module({
  imports: [YoomoneyModule, StripeModule],
  providers: [PaymentProviderRegistry, PaymentProviderService],
  exports: [PaymentProviderService, PaymentProviderRegistry, YoomoneyModule, StripeModule],
})
export class PaymentProvidersModule {}
