import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { YooKassaWebhookDto } from './yookassa-webhook.dto';

/** Payload shape similar to real YooKassa sandbox webhooks (extra fields included). */
const sandboxPayload = {
  type: 'notification',
  event: 'payment.succeeded',
  object: {
    id: '31f94b9f-000f-5001-9000-1ae1858d1a52',
    status: 'succeeded',
    paid: true,
    amount: { value: '62028.73', currency: 'RUB' },
    authorization_details: {
      rrn: '123456789012',
      auth_code: '123456',
    },
    created_at: '2026-07-27T10:49:17.000Z',
    description: 'Booking payment',
    expires_at: '2026-07-27T11:19:17.000Z',
    metadata: {
      transactionId: 'tx-1',
      bookingId: 'bk-1',
    },
    payment_method: {
      type: 'bank_card',
      id: '31f94b9f-000f-5001-9000-1ae1858d1a52',
      saved: false,
      status: 'succeeded',
      title: 'Bank card *1111',
      card: {
        first6: '555555',
        last4: '4444',
        expiry_year: '2030',
        expiry_month: '12',
        card_type: 'MasterCard',
        card_product: { code: 'E' },
        issuer_country: 'RU',
      },
    },
    recipient: { account_id: '1280288', gateway_id: '1280288' },
    refundable: true,
    test: true,
  },
};

describe('YooKassaWebhookDto', () => {
  it('accepts sandbox payload when extra fields are not forbidden', async () => {
    const dto = plainToInstance(YooKassaWebhookDto, sandboxPayload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    expect(errors).toHaveLength(0);
    expect(dto.object.id).toBe(sandboxPayload.object.id);
    expect(dto.object.metadata.transactionId).toBe('tx-1');
  });

  it('fails global forbidNonWhitelisted validation (documents why webhook uses a dedicated pipe)', async () => {
    const dto = plainToInstance(YooKassaWebhookDto, sandboxPayload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
