import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: {
    handleYookassa: jest.Mock;
    handleStripe: jest.Mock;
  };

  beforeEach(async () => {
    webhookService = {
      handleYookassa: jest.fn().mockResolvedValue({ ok: true }),
      handleStripe: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: webhookService }],
    }).compile();

    controller = module.get(WebhookController);
  });

  it('returns ok for yookassa health check', async () => {
    await expect(controller.greet()).resolves.toEqual({ ok: true });
  });

  it('delegates yookassa webhook to service', async () => {
    const dto = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: 'p1',
        status: 'succeeded',
        amount: { value: '1000.00', currency: 'RUB' },
        metadata: { transactionId: 't1', bookingId: 'b1' },
        created_at: '2026-06-17T10:00:00Z',
      },
    };

    await controller.handleYookassa(dto as never, '127.0.0.1');

    expect(webhookService.handleYookassa).toHaveBeenCalledWith(dto, '127.0.0.1');
  });

  it('throws UnauthorizedException when stripe signature is missing', async () => {
    await expect(
      controller.handleStripe({ rawBody: Buffer.from('{}') } as never, undefined as never),
    ).rejects.toThrow(UnauthorizedException);

    expect(webhookService.handleStripe).not.toHaveBeenCalled();
  });

  it('delegates stripe webhook when signature is present', async () => {
    const req = { rawBody: Buffer.from('{}') };

    await controller.handleStripe(req as never, 'sig_test');

    expect(webhookService.handleStripe).toHaveBeenCalledWith(req.rawBody, 'sig_test');
  });
});
