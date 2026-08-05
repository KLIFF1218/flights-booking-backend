import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { WebhookService } from './webhook.service';
import { PaymentHandler } from '../handlers/payment.handler';
import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { PaymentProviderService } from '../services/payment-provider.service';
import { type YooKassaWebhookDto } from './dto/yookassa-webhook.dto';

describe('WebhookService', () => {
  let service: WebhookService;
  let paymentProviderService: jest.Mocked<
    Pick<PaymentProviderService, 'verifyWebhookIngress' | 'parseWebhookIngress' | 'handleWebhook'>
  >;
  let paymentHandler: jest.Mocked<Pick<PaymentHandler, 'processResult'>>;

  beforeEach(async () => {
    paymentProviderService = {
      verifyWebhookIngress: jest.fn(),
      parseWebhookIngress: jest.fn(),
      handleWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PaymentProviderService, useValue: paymentProviderService },
        {
          provide: PaymentHandler,
          useValue: {
            processResult: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordWebhookIgnored: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WebhookService);
    paymentHandler = module.get(PaymentHandler);
  });

  it('should verify ingress, process webhook and pass result to payment handler', async () => {
    const dto: YooKassaWebhookDto = {
      event: 'payment.succeeded',
      object: { id: '1', metadata: { transactionId: 't1', bookingId: 'b1' } },
    };

    const ip = '127.0.0.1';

    const mockResult = {
      transactionId: 't1',
      bookingId: 'b1',
      paymentId: 'p1',
      provider: PaymentProvider.YOOKASSA,
      eventId: 'payment.succeeded:p1',
      status: TransactionStatus.SUCCEED,
    };

    paymentProviderService.handleWebhook.mockResolvedValue(mockResult);

    const result = await service.handleYookassa(dto, ip);

    expect(paymentProviderService.verifyWebhookIngress).toHaveBeenCalledWith(
      PaymentProvider.YOOKASSA,
      { ip },
    );
    expect(paymentProviderService.handleWebhook).toHaveBeenCalledWith(
      PaymentProvider.YOOKASSA,
      dto,
    );
    expect(paymentHandler.processResult).toHaveBeenCalledWith(mockResult);
    expect(result).toEqual({ ok: true });
  });

  it('should throw if verifyWebhookIngress throws', async () => {
    const dto: YooKassaWebhookDto = {
      event: 'payment.waiting_for_capture',
      object: { id: '2' },
    };

    paymentProviderService.verifyWebhookIngress.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(service.handleYookassa(dto, '10.0.0.1')).rejects.toThrow('invalid signature');

    expect(paymentProviderService.handleWebhook).not.toHaveBeenCalled();
    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });

  it('should throw if handleWebhook fails', async () => {
    const dto: YooKassaWebhookDto = {
      event: 'payment.canceled',
      object: { id: '3' },
    };

    paymentProviderService.handleWebhook.mockRejectedValue(new Error('Webhook parse failed'));

    await expect(service.handleYookassa(dto, '8.8.8.8')).rejects.toThrow('Webhook parse failed');

    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });

  it('should parse stripe ingress and process webhook result', async () => {
    const rawBody = Buffer.from('{}');
    const sig = 't=123,v1=abc';
    const event = { id: 'evt_1', type: 'checkout.session.completed' };
    const mockResult = {
      transactionId: 't1',
      bookingId: 'b1',
      paymentId: 'pi_1',
      provider: PaymentProvider.STRIPE,
      eventId: 'evt_1',
      status: TransactionStatus.SUCCEED,
    };

    paymentProviderService.parseWebhookIngress.mockResolvedValue(event);
    paymentProviderService.handleWebhook.mockResolvedValue(mockResult);

    await service.handleStripe(rawBody, sig);

    expect(paymentProviderService.parseWebhookIngress).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      { rawBody, stripeSignature: sig },
    );
    expect(paymentProviderService.handleWebhook).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      event,
    );
    expect(paymentHandler.processResult).toHaveBeenCalledWith(mockResult);
  });

  it('should return ok when stripe webhook has no actionable result', async () => {
    const rawBody = Buffer.from('{}');
    const sig = 't=123,v1=abc';
    const event = { id: 'evt_2', type: 'charge.refunded' };

    paymentProviderService.parseWebhookIngress.mockResolvedValue(event);
    paymentProviderService.handleWebhook.mockResolvedValue(null);

    const result = await service.handleStripe(rawBody, sig);

    expect(result).toEqual({ ok: true });
    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });
});
