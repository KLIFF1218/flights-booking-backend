import { parsePaymentProviderMeta } from '../types/payment-provider-meta.types';

export function isLateSuccessRefundCompleted(providerMeta: unknown): boolean {
  return parsePaymentProviderMeta(providerMeta).lateSuccessRefunded === true;
}

export function isLateSuccessReconciliationRecorded(providerMeta: unknown): boolean {
  return parsePaymentProviderMeta(providerMeta).lateSuccessReconciliationRecorded === true;
}

export function isTicketingCompensationRecorded(providerMeta: unknown): boolean {
  return parsePaymentProviderMeta(providerMeta).ticketingCompensationRecorded === true;
}

export function hasTicketingRefundCompleted(providerMeta: unknown): boolean {
  return parsePaymentProviderMeta(providerMeta).ticketingFailedRefundCompleted === true;
}

export function hasTicketingInventoryReleased(providerMeta: unknown): boolean {
  return parsePaymentProviderMeta(providerMeta).ticketingFailedInventoryReleased === true;
}

export function hasTicketingCompensationCompleted(
  providerMeta: unknown,
  refundRequired: boolean,
): boolean {
  if (refundRequired) {
    return hasTicketingRefundCompleted(providerMeta) && hasTicketingInventoryReleased(providerMeta);
  }

  return hasTicketingInventoryReleased(providerMeta);
}
