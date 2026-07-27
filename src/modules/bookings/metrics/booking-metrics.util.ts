import {
  normalizeBookingOutboxTopic,
  resolveBookingMetricReason,
} from './booking-metrics-reason.util';
import type { BookingCheckoutStage } from './booking-metrics.constants';

type CheckoutRollbackFlags = {
  seatsAssigned: boolean;
  pricingUpdated: boolean;
  paymentCreated: boolean;
};

export function resolveCheckoutFailureStage(flags: CheckoutRollbackFlags): BookingCheckoutStage {
  if (!flags.seatsAssigned) {
    return 'assign_seats';
  }

  if (!flags.pricingUpdated) {
    return 'pricing';
  }

  if (!flags.paymentCreated) {
    return 'payment';
  }

  return 'cache';
}

export function isBookingOutboxTopic(topic: string): boolean {
  return normalizeBookingOutboxTopic(topic) !== 'other';
}

export { resolveBookingMetricReason };
