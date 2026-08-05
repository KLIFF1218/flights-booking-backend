/** Redis lock TTL — slightly under the 1-minute cron interval. */
export const BOOKING_MAINTENANCE_LOCK_TTL_SECONDS = 55;

export const BOOKING_MAINTENANCE_LOCK_KEY = 'scheduler:booking-maintenance';

export type BookingMaintenanceStep =
  | 'expire_bookings'
  | 'reconcile_orphan_payments'
  | 'abandon_payments'
  | 'release_expired_holds';
