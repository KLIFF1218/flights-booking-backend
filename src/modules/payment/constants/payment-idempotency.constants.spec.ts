import { buildPaymentWebhookIdempotencyKey } from './payment-idempotency.constants';
import { TransactionStatus } from '@prisma/client';

describe('payment-idempotency.constants', () => {
  it('builds stable webhook idempotency key from transaction and status', () => {
    expect(buildPaymentWebhookIdempotencyKey('tx-1', TransactionStatus.SUCCEED)).toBe(
      'tx-1:SUCCEED',
    );
  });
});
