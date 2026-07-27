export const BOOKING_METRIC_REASONS = [
  'validation',
  'not_found',
  'status_conflict',
  'expired',
  'seat_unavailable',
  'inventory_unavailable',
  'traveler_mismatch',
  'duplicate_traveler',
  'provider_timeout',
  'provider_error',
  'db_conflict',
  'outbox_failed',
  'unknown',
] as const;

export type BookingMetricReason = (typeof BOOKING_METRIC_REASONS)[number];

export const BOOKING_OPERATIONS = [
  'create',
  'add_travelers',
  'assign_seats',
  'checkout',
  'cancel',
  'expire',
  'release_seats',
  'get_tickets',
  'list',
] as const;

export type BookingOperationName = (typeof BOOKING_OPERATIONS)[number];

export const BOOKING_CHECKOUT_STAGES = ['assign_seats', 'pricing', 'payment', 'cache'] as const;

export type BookingCheckoutStage = (typeof BOOKING_CHECKOUT_STAGES)[number];

export const BOOKING_MAINTENANCE_JOBS = [
  'expire_bookings',
  'release_expired_holds',
  'abandon_payments',
] as const;

export type BookingMaintenanceJob = (typeof BOOKING_MAINTENANCE_JOBS)[number];

export const BOOKING_CACHE_NAMES = ['user_list', 'booking_detail'] as const;

export type BookingCacheName = (typeof BOOKING_CACHE_NAMES)[number];

export const BOOKING_OUTBOX_TOPICS = [
  'booking.created',
  'booking.expired',
  'booking.paid',
  'booking.canceled',
  'payment.failed',
  'payment.pending.cancel',
  'checkout.cleanup',
  'booking.ticketing.failed',
  'booking.create.compensation',
  'other',
] as const;

export type BookingOutboxTopic = (typeof BOOKING_OUTBOX_TOPICS)[number];
