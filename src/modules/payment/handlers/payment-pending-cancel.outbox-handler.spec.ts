import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentProvider } from '@prisma/client';
import { PaymentPendingCancelOutboxHandler } from './payment-pending-cancel.outbox-handler';
import { PaymentProviderService } from '../services/payment-provider.service';

describe('PaymentPendingCancelOutboxHandler', () => {
  let handler: PaymentPendingCancelOutboxHandler;

  const paymentProviderService = {
    cancelPendingPaymentBestEffort: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentPendingCancelOutboxHandler,
        {
          provide: PaymentProviderService,
          useValue: paymentProviderService,
        },
      ],
    }).compile();

    handler = module.get(PaymentPendingCancelOutboxHandler);
  });

  it('cancels pending payment at provider', async () => {
    await handler.handle({
      transactionId: 'tx-1',
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });

    expect(paymentProviderService.cancelPendingPaymentBestEffort).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'cs_test_1',
      { transactionId: 'tx-1' },
    );
  });

  it('skips provider cancel when external id is missing', async () => {
    await handler.handle({
      transactionId: 'tx-1',
      provider: PaymentProvider.STRIPE,
      externalId: null,
    });

    expect(paymentProviderService.cancelPendingPaymentBestEffort).not.toHaveBeenCalled();
  });
});
