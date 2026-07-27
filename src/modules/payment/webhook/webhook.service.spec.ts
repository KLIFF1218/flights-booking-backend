import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { WebhookService } from './webhook.service';
import { YookassaProvider } from '../providers/yoomoney/yoomoney.service';
import { StripeService } from '../providers/stripe/stripe.service';
import { PaymentHandler } from '../payment.handler';
import { type YooKassaWebhookDto } from './dto/yookassa-webhook.dto';
import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { MetricsService } from 'src/infra/metrics/metrics.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let yookassaProvider: jest.Mocked<Pick<YookassaProvider, 'verifyWebhookIp' | 'handleWebhook'>>;
  let stripeService: jest.Mocked<Pick<StripeService, 'parseEvent' | 'handleWebhook'>>;
  let paymentHandler: jest.Mocked<Pick<PaymentHandler, 'processResult'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: YookassaProvider,
          useValue: {
            verifyWebhookIp: jest.fn(),
            handleWebhook: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            parseEvent: jest.fn(),
            handleWebhook: jest.fn(),
          },
        },
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
    yookassaProvider = module.get(YookassaProvider);
    stripeService = module.get(StripeService);
    paymentHandler = module.get(PaymentHandler);
  });

  it('should verify IP, process webhook and pass result to payment handler', async () => {
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

    yookassaProvider.handleWebhook.mockResolvedValue(mockResult);

    const result = await service.handleYookassa(dto, ip);

    expect(yookassaProvider.verifyWebhookIp).toHaveBeenCalledWith(ip);
    expect(yookassaProvider.handleWebhook).toHaveBeenCalledWith(dto);
    expect(paymentHandler.processResult).toHaveBeenCalledWith(mockResult);
    expect(result).toEqual({ ok: true });
  });

  it('should throw if verifyWebhookIp throws', async () => {
    const dto: YooKassaWebhookDto = {
      event: 'payment.waiting_for_capture',
      object: { id: '2' },
    };

    const ip = '10.0.0.1';

    yookassaProvider.verifyWebhookIp.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(service.handleYookassa(dto, ip)).rejects.toThrow('invalid signature');

    expect(yookassaProvider.handleWebhook).not.toHaveBeenCalled();
    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });

  it('should throw if handleWebhook fails', async () => {
    const dto: YooKassaWebhookDto = {
      event: 'payment.canceled',
      object: { id: '3' },
    };

    const ip = '8.8.8.8';

    yookassaProvider.handleWebhook.mockRejectedValue(new Error('Webhook parse failed'));

    await expect(service.handleYookassa(dto, ip)).rejects.toThrow('Webhook parse failed');

    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });

  it('should parse stripe event and process webhook result', async () => {
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

    stripeService.parseEvent.mockResolvedValue(event);
    stripeService.handleWebhook.mockResolvedValue(mockResult);

    await service.handleStripe(rawBody, sig);

    expect(stripeService.parseEvent).toHaveBeenCalledWith(rawBody, sig);
    expect(stripeService.handleWebhook).toHaveBeenCalledWith(event);
    expect(paymentHandler.processResult).toHaveBeenCalledWith(mockResult);
  });

  it('should return ok when stripe webhook has no actionable result', async () => {
    const rawBody = Buffer.from('{}');
    const sig = 't=123,v1=abc';
    const event = { id: 'evt_2', type: 'charge.refunded' };

    stripeService.parseEvent.mockResolvedValue(event);
    stripeService.handleWebhook.mockResolvedValue(null);

    const result = await service.handleStripe(rawBody, sig);

    expect(result).toEqual({ ok: true });
    expect(paymentHandler.processResult).not.toHaveBeenCalled();
  });
});
