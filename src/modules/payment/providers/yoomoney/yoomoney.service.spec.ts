import { Test, type TestingModule } from '@nestjs/testing';
import { YookassaProvider } from './yoomoney.service';
import { ConfigService } from '@nestjs/config';
import {
  YookassaService,
  PaymentMethodsEnum,
  ConfirmationEnum,
  CurrencyEnum,
} from 'nestjs-yookassa';
import { ForbiddenException } from '@nestjs/common';
import { TransactionStatus, Currency } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import ipRangeCheck from 'ip-range-check';

// Mock ip-range-check
jest.mock('ip-range-check', () => jest.fn());

describe('YookassaProvider', () => {
  let service: YookassaProvider;
  let yookassaService: jest.Mocked<YookassaService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    yookassaService = {
      payments: {
        create: jest.fn(),
        capture: jest.fn(),
        getById: jest.fn(),
        cancel: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
      },
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'YOOKASSA_SHOP_ID') return 'shop-1';
        if (key === 'YOOKASSA_API_KEY') return 'api-key-1';
        if (key === 'APP_URL') return 'https://example.com';
        return undefined;
      }),
    } as any;

    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YookassaProvider,
        { provide: YookassaService, useValue: yookassaService },
        { provide: ConfigService, useValue: configService },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get(YookassaProvider);
  });

  //
  // createPayment
  //
  it('throws BadRequestException when YooKassa is not configured', async () => {
    configService.get.mockImplementation(() => undefined);

    await expect(
      service.createPayment({
        transactionId: 't123',
        bookingId: 'b123',
        amount: 1000,
        currency: 'RUB' as any,
        idempotencyKey: 'idem-123',
      }),
    ).rejects.toThrow('YooKassa is not configured');
  });

  it('throws BadRequestException for non-RUB currency', async () => {
    await expect(
      service.createPayment({
        transactionId: 't_usd',
        bookingId: 'b_usd',
        amount: 100,
        currency: Currency.USD,
        idempotencyKey: 'idem-usd',
      }),
    ).rejects.toThrow('YooKassa only supports RUB');
  });

  it('should call yookassaService.payments.create with correct params', async () => {
    const params = {
      transactionId: 't123',
      bookingId: 'b123',
      amount: 1000,
      currency: 'RUB' as any,
      idempotencyKey: 'idem-123',
    };

    yookassaService.payments.create.mockResolvedValue({
      id: 'pay_1',
      confirmation: { confirmation_url: 'https://yookassa.ru/pay/pay_1' },
    });

    const result = await service.createPayment(params);

    const returnUrl = `https://example.com/payment/${params.transactionId}/success`;

    expect(yookassaService.payments.create).toHaveBeenCalledWith({
      amount: {
        value: 1000,
        currency: CurrencyEnum.RUB,
      },
      description: 'Booking payment',
      payment_method_data: { type: PaymentMethodsEnum.BANK_CARD },
      confirmation: {
        type: ConfirmationEnum.REDIRECT,
        return_url: returnUrl,
      },
      capture: false,
      metadata: {
        transactionId: params.transactionId,
        bookingId: params.bookingId,
      },
    });

    expect(result).toEqual({
      externalId: 'pay_1',
      redirectUrl: 'https://yookassa.ru/pay/pay_1',
      meta: {
        id: 'pay_1',
        confirmation: { confirmation_url: 'https://yookassa.ru/pay/pay_1' },
      },
    });
  });

  it('should handle ForbiddenException when createPayment fails', async () => {
    const params = {
      transactionId: 't_fail',
      bookingId: 'b_fail',
      amount: 500,
      currency: 'RUB' as any,
      idempotencyKey: 'idem-fail',
    };

    yookassaService.payments.create.mockRejectedValue(new Error('API error'));

    await expect(service.createPayment(params)).rejects.toThrow(ForbiddenException);
  });

  it('should handle decimal amount correctly', async () => {
    const params = {
      transactionId: 't_decimal',
      bookingId: 'b_decimal',
      amount: 99.99,
      currency: 'RUB' as any,
      idempotencyKey: 'idem-decimal',
    };

    yookassaService.payments.create.mockResolvedValue({
      id: 'pay_decimal',
      confirmation: { confirmation_url: 'https://yookassa.ru/pay/pay_decimal' },
    });

    await service.createPayment(params);

    expect(yookassaService.payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expect.objectContaining({
          value: 99.99,
        }),
      }),
    );
  });

  //
  // getPayment, capturePayment, cancelPayment, refundPayment
  //
  it('getPayment should call yookassaService.payments.getById', async () => {
    yookassaService.payments.getById.mockResolvedValue({ id: 'pay_1' });

    const result = await service.getPayment('pay_1');

    expect(yookassaService.payments.getById).toHaveBeenCalledWith('pay_1');
    expect(result).toEqual({ id: 'pay_1' });
  });

  it('capturePayment should call yookassaService.payments.capture', async () => {
    yookassaService.payments.capture.mockResolvedValue({ id: 'pay_1', captured: true });

    const result = await service.capturePayment('pay_1');

    expect(yookassaService.payments.capture).toHaveBeenCalledWith('pay_1');
    expect(result).toEqual({ id: 'pay_1', captured: true });
  });

  it('cancelPayment should call yookassaService.payments.cancel', async () => {
    yookassaService.payments.cancel.mockResolvedValue({ id: 'pay_1', canceled: true });

    const result = await service.cancelPayment('pay_1');

    expect(yookassaService.payments.cancel).toHaveBeenCalledWith('pay_1');
    expect(result).toEqual({ id: 'pay_1', canceled: true });
  });

  it('refundPayment should call yookassaService.refunds.create', async () => {
    yookassaService.refunds.create.mockResolvedValue({ id: 'refund_1' });

    const result = await service.refundPayment('pay_1');

    expect(yookassaService.refunds.create).toHaveBeenCalledWith({
      payment_id: 'pay_1',
    });
    expect(result).toEqual({ id: 'refund_1' });
  });

  //
  // handleWebhook
  //
  it('should process "payment.succeeded"', async () => {
    const dto = {
      event: 'payment.succeeded',
      object: {
        id: 'p1',
        metadata: { transactionId: 't1', bookingId: 'b1' },
      },
    };

    const result = await service.handleWebhook(dto as any);

    expect(result).toEqual({
      transactionId: 't1',
      paymentId: 'p1',
      bookingId: 'b1',
      provider: 'YOOKASSA',
      eventId: 'payment.succeeded:p1',
      status: TransactionStatus.SUCCEED,
      method: 'unknown',
    });
  });

  it('should process "payment.canceled"', async () => {
    const dto = {
      event: 'payment.canceled',
      object: {
        id: 'p2',
        metadata: { transactionId: 't2', bookingId: 'b2' },
      },
    };

    const result = await service.handleWebhook(dto as any);

    expect(result.status).toBe(TransactionStatus.CANCELED);
  });

  it('should process "payment.waiting_for_capture" and call capture()', async () => {
    const dto = {
      event: 'payment.waiting_for_capture',
      object: {
        id: 'p3',
        metadata: { transactionId: 't3', bookingId: 'b3' },
      },
    };

    yookassaService.payments.capture.mockResolvedValue(true);

    const result = await service.handleWebhook(dto as any);

    expect(yookassaService.payments.capture).toHaveBeenCalledWith('p3');
    expect(result.status).toBe(TransactionStatus.SUCCEED);
  });

  it('should not throw if capture() fails', async () => {
    const dto = {
      event: 'payment.waiting_for_capture',
      object: {
        id: 'p9',
        metadata: { transactionId: 't9', bookingId: 'b9' },
      },
    };

    yookassaService.payments.capture.mockRejectedValue(new Error('capture failed'));

    const result = await service.handleWebhook(dto as any);

    // Error is logged, but the function does not throw
    expect(result.status).toBe(TransactionStatus.AUTHORIZED);
  });

  it('should warn for unhandled events', async () => {
    const dto = {
      event: 'unhandled.event',
      object: {
        id: 'p4',
        metadata: { transactionId: 't4', bookingId: 'b4' },
      },
    };

    const result = await service.handleWebhook(dto as any);

    expect(result.status).toBe(TransactionStatus.PENDING);
  });

  it('should throw ForbiddenException when webhook has no metadata', async () => {
    const dto = {
      event: 'payment.succeeded',
      object: {
        id: 'p_no_meta',
        metadata: null,
      },
    };

    await expect(service.handleWebhook(dto as any)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when transactionId is missing', async () => {
    const dto = {
      event: 'payment.succeeded',
      object: {
        id: 'p_partial',
        metadata: { bookingId: 'b_only' },
      },
    };

    await expect(service.handleWebhook(dto as any)).rejects.toThrow(ForbiddenException);
  });

  //
  // verifyWebhookIp
  //
  it('should allow request from allowed IP range', () => {
    (ipRangeCheck as jest.Mock).mockReturnValue(true);

    expect(() => service.verifyWebhookIp('185.71.76.10')).not.toThrow();
  });

  it('should throw ForbiddenException for disallowed IP', () => {
    (ipRangeCheck as jest.Mock).mockReturnValue(false);

    expect(() => service.verifyWebhookIp('1.1.1.1')).toThrow(ForbiddenException);
  });

  it('should allow IPv6 from allowed range', () => {
    (ipRangeCheck as jest.Mock).mockReturnValue(true);

    expect(() => service.verifyWebhookIp('2a02:5180::1')).not.toThrow();
  });
});
