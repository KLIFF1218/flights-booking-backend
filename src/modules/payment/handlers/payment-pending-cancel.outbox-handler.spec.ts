import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentPendingCancelOutboxHandler } from './payment-pending-cancel.outbox-handler';
import { PaymentAbandonmentService } from '../services/payment-abandonment.service';

describe('PaymentPendingCancelOutboxHandler', () => {
  let handler: PaymentPendingCancelOutboxHandler;
  let module: TestingModule;

  const paymentAbandonmentService = {
    cancelPendingPaymentAtProviderBestEffort: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        PaymentPendingCancelOutboxHandler,
        {
          provide: PaymentAbandonmentService,
          useValue: paymentAbandonmentService,
        },
      ],
    }).compile();

    handler = module.get(PaymentPendingCancelOutboxHandler);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('delegates pending cancel to abandonment service', async () => {
    await handler.handle({
      transactionId: 'tx-1',
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });

    expect(paymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort).toHaveBeenCalledWith(
      {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
        provider: PaymentProvider.STRIPE,
        externalId: 'cs_test_1',
      },
    );
  });
});
