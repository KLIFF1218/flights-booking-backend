import type { ArgumentMetadata } from '@nestjs/common';
import { AppValidationPipe } from './app-validation.pipe';
import { YooKassaWebhookDto } from 'src/modules/payment/webhook/dto/yookassa-webhook.dto';

describe('AppValidationPipe', () => {
  const pipe = new AppValidationPipe();

  it('uses relaxed validation for YooKassaWebhookDto', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: YooKassaWebhookDto,
      data: '',
    };

    const payload = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: 'obj_1',
        status: 'succeeded',
        amount: { value: '1000', currency: 'RUB' },
        metadata: { transactionId: 'tr_1', bookingId: 'bk_1' },
        created_at: '2026-06-17T10:00:00.000Z',
        extraPspField: 'allowed',
      },
    };

    await expect(pipe.transform(payload, metadata)).resolves.toEqual(
      expect.objectContaining({
        type: 'notification',
        event: 'payment.succeeded',
      }),
    );
  });

  it('rejects unknown fields for regular DTOs', async () => {
    class SampleDto {
      name!: string;
    }

    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: SampleDto,
      data: '',
    };

    await expect(pipe.transform({ name: 'ok', extra: 'nope' }, metadata)).rejects.toThrow();
  });
});
