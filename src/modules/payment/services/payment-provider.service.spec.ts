import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentProvider, Currency } from '@prisma/client';
import { StripeService } from '../providers/stripe/stripe.service';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';

describe('PaymentProviderService', () => {
  let service: PaymentProviderService;
  let stripe: { createPayment: jest.Mock };
  let yookassa: { createPayment: jest.Mock };

  beforeEach(async () => {
    stripe = { createPayment: jest.fn() };
    yookassa = { createPayment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderService,
        { provide: StripeService, useValue: stripe },
        { provide: YookassaProvider, useValue: yookassa },
      ],
    }).compile();

    service = module.get<PaymentProviderService>(PaymentProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call StripeService.createPayment when provider is STRIPE', async () => {
    const dto = {
      transactionId: 'tx_1',
      amount: '1000',
      currency: 'RUB',
      idempotencyKey: 'idem-1',
      provider: PaymentProvider.STRIPE,
    } as const;

    stripe.createPayment.mockResolvedValue({ redirectUrl: 'https://stripe.pay' });

    const result = await service.get(dto);

    expect(result).toEqual({ redirectUrl: 'https://stripe.pay' });
    expect(stripe.createPayment).toHaveBeenCalledWith({
      transactionId: 'tx_1',
      amount: Number(dto.amount),
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
    });
  });

  it('should call YookassaProvider.createPayment when provider is YOOKASSA', async () => {
    const dto = {
      transactionId: 'tx_2',
      amount: '500',
      currency: 'RUB',
      idempotencyKey: 'idem-2',
      provider: PaymentProvider.YOOKASSA,
    } as const;

    yookassa.createPayment.mockResolvedValue({ redirectUrl: 'https://yoo.pay' });

    const result = await service.get(dto);

    expect(result).toEqual({ redirectUrl: 'https://yoo.pay' });
    expect(yookassa.createPayment).toHaveBeenCalledWith({
      transactionId: 'tx_2',
      amount: Number(dto.amount),
      currency: Currency.RUB,
      idempotencyKey: dto.idempotencyKey,
    });
  });

  it('should throw BadRequestException for unsupported provider', () => {
    const dto = {
      transactionId: 'tx_3',
      amount: '100',
      currency: 'RUB',
      idempotencyKey: 'idem-3',
      provider: 'STARS' as PaymentProvider,
    } as const;

    expect(() => service.get(dto)).toThrow(BadRequestException);
    expect(() => service.get(dto)).toThrow('Unsupported payment provider: STARS');
  });

  it('should cancel pending YooKassa payment', async () => {
    yookassa.cancelPendingPaymentIfNeeded = jest.fn().mockResolvedValue(undefined);

    await service.cancelPendingPayment(PaymentProvider.YOOKASSA, 'pay-1');

    expect(yookassa.cancelPendingPaymentIfNeeded).toHaveBeenCalledWith('pay-1');
  });

  it('should cancel pending Stripe checkout session', async () => {
    stripe.cancelPendingCheckoutSession = jest.fn().mockResolvedValue(undefined);

    await service.cancelPendingPayment(PaymentProvider.STRIPE, 'cs_test_1');

    expect(stripe.cancelPendingCheckoutSession).toHaveBeenCalledWith('cs_test_1');
  });
});
