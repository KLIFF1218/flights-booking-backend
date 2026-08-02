import { parsePaymentProviderMeta, mergePaymentProviderMeta } from './payment-provider-meta.types';

describe('payment-provider-meta.types', () => {
  it('parses empty meta from non-object values', () => {
    expect(parsePaymentProviderMeta(null)).toEqual({});
    expect(parsePaymentProviderMeta(undefined)).toEqual({});
  });

  it('merges provider meta patches', () => {
    expect(
      mergePaymentProviderMeta({ lateSuccessRefunded: false }, {
        lateSuccessRefunded: true,
        lateSuccessRefundedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      lateSuccessRefunded: true,
      lateSuccessRefundedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
