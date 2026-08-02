import { PaymentProvider, TransactionStatus } from '@prisma/client';
import type { YooKassaWebhookDto } from 'src/modules/payment/webhook/dto/yookassa-webhook.dto';

export const E2E_PAYMENT_REDIRECT_URL = 'https://pay.test/checkout';

export const s3E2eStub = {
  getSignedUrl: async () => 'https://s3.test/ticket.pdf',
  getDownloadUrl: async () => 'https://s3.test/ticket.pdf',
  upload: async () => undefined,
};

export function createE2ePaymentProviderStub() {
  return {
    get: async () => ({
      externalId: 'e2e_payment_ext',
      redirectUrl: E2E_PAYMENT_REDIRECT_URL,
      meta: {},
    }),
    getPendingPaymentRedirectUrl: async (_provider: PaymentProvider, externalId: string | null) =>
      externalId ? E2E_PAYMENT_REDIRECT_URL : null,
    cancelPendingPayment: async () => undefined,
    refundSucceededPayment: async () => undefined,
    captureAuthorizedPayment: async () => undefined,
    supportsCaptureAfterAuthorize: () => true,
  };
}

export function createE2ePaymentAbandonmentStub() {
  return {
    abandonPayment: async () => undefined,
    cancelPendingPaymentAtProviderBestEffort: async () => undefined,
    refundLateSuccessBestEffort: async () => undefined,
    markLateSuccessReconciliationRecorded: async () => undefined,
    markLateSuccessRefundCompleted: async () => undefined,
    compensateTicketingFailure: async () => undefined,
  };
}

export function createE2eYookassaWebhookStub() {
  return {
    verifyWebhookIp: () => undefined,
    handleWebhook: async (dto: YooKassaWebhookDto) => {
      const transactionId = dto.object.metadata.transactionId;
      const bookingId = dto.object.metadata.bookingId;
      const paymentId = dto.object.id;

      let status = TransactionStatus.PENDING;

      switch (dto.event) {
        case 'payment.succeeded':
          status = TransactionStatus.SUCCEED;
          break;
        case 'payment.canceled':
          status = TransactionStatus.CANCELED;
          break;
        case 'payment.waiting_for_capture':
          status = TransactionStatus.AUTHORIZED;
          break;
        default:
          break;
      }

      return {
        transactionId,
        bookingId,
        paymentId,
        provider: PaymentProvider.YOOKASSA,
        eventId: `${dto.event}:${paymentId}`,
        status,
        method: dto.object.payment_method?.type ?? 'unknown',
        ...(dto.event === 'payment.waiting_for_capture'
          ? { requiresCaptureAfterAuthorize: true }
          : {}),
      };
    },
  };
}

export function createE2eStripeWebhookStub() {
  return {
    parseEvent: async () => ({ id: 'evt_e2e', type: 'checkout.session.completed' }),
    handleWebhook: async () => null,
  };
}
