import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { PaymentService } from 'src/modules/payment/services/payment.service';
import { PaymentProviderService } from 'src/modules/payment/services/payment-provider.service';
import { PaymentAbandonmentService } from 'src/modules/payment/services/payment-abandonment.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { BookingExpirationE2eModule } from './booking-expiration-e2e.module';
import {
  createE2ePaymentAbandonmentStub,
  createE2ePaymentProviderStub,
  s3E2eStub,
} from './e2e-payment.stubs';

/** PaymentService with stubbed provider — persists transactions without Stripe/YooKassa. */
@Module({
  imports: [PrismaModule, MetricsModule, BookingExpirationE2eModule],
  providers: [
    PaymentService,
    { provide: PaymentProviderService, useValue: createE2ePaymentProviderStub() },
    { provide: PaymentAbandonmentService, useValue: createE2ePaymentAbandonmentStub() },
    { provide: S3Service, useValue: s3E2eStub },
  ],
  exports: [PaymentService],
})
export class PaymentsE2eModule {}
