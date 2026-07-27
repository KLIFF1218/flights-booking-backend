import { isYookassaWebhookRequest } from './app-validation.pipe';

describe('isYookassaWebhookRequest', () => {
  it('matches POST yookassa webhook paths', () => {
    expect(
      isYookassaWebhookRequest({
        method: 'POST',
        path: '/api/v1/webhook/yookassa',
        url: '/api/v1/webhook/yookassa',
      }),
    ).toBe(true);
  });

  it('ignores GET health check', () => {
    expect(
      isYookassaWebhookRequest({
        method: 'GET',
        path: '/api/v1/webhook/yookassa',
        url: '/api/v1/webhook/yookassa',
      }),
    ).toBe(false);
  });

  it('ignores other routes', () => {
    expect(
      isYookassaWebhookRequest({
        method: 'POST',
        path: '/api/v1/booking',
        url: '/api/v1/booking',
      }),
    ).toBe(false);
  });
});
