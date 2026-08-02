import type { Prisma } from '@prisma/client';

export interface PaymentProviderMeta {
  lateSuccessRefunded?: boolean;
  lateSuccessRefundedAt?: string;
  lateSuccessReconciliationRecorded?: boolean;
  lateSuccessReconciliationRecordedAt?: string;
  ticketingFailedRefundCompleted?: boolean;
  ticketingFailedInventoryReleased?: boolean;
  ticketingFailedReason?: string;
  ticketingFailedRefundedAt?: string;
  ticketingFailedAt?: string;
}

export function parsePaymentProviderMeta(raw: unknown): PaymentProviderMeta {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return { ...(raw as PaymentProviderMeta) };
}

export function mergePaymentProviderMeta(
  raw: unknown,
  patch: PaymentProviderMeta,
): Prisma.InputJsonValue {
  return {
    ...parsePaymentProviderMeta(raw),
    ...patch,
  } as Prisma.InputJsonValue;
}
