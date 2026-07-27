export type DailyAnalyticsIncrements = {
  bookingsCreated: number;
  paymentsSucceeded: number;
  paymentsFailed: number;
  bookingsCanceled: number;
  bookingsExpired: number;
  ticketsIssued: number;
  ticketingFailed: number;
  flightsDelayed: number;
  flightsCancelled: number;
  paymentVolume: number;
};

export const EMPTY_DAILY_INCREMENTS: DailyAnalyticsIncrements = {
  bookingsCreated: 0,
  paymentsSucceeded: 0,
  paymentsFailed: 0,
  bookingsCanceled: 0,
  bookingsExpired: 0,
  ticketsIssued: 0,
  ticketingFailed: 0,
  flightsDelayed: 0,
  flightsCancelled: 0,
  paymentVolume: 0,
};

const ANALYTICS_EVENT_TYPES = new Set([
  'booking.created',
  'booking.expired',
  'booking.paid',
  'payment.failed',
  'booking.canceled',
  'booking.ticketing.failed',
  'ticket.issued',
  'flight.delayed',
  'flight.cancelled',
]);

export function isAnalyticsEventType(eventType: string): boolean {
  return ANALYTICS_EVENT_TYPES.has(eventType);
}

export function incrementsForEventType(
  eventType: string,
  paymentVolume = 0,
): DailyAnalyticsIncrements {
  const increments = { ...EMPTY_DAILY_INCREMENTS };

  switch (eventType) {
    case 'booking.created':
      increments.bookingsCreated = 1;
      break;
    case 'booking.expired':
      increments.bookingsExpired = 1;
      break;
    case 'booking.canceled':
      increments.bookingsCanceled = 1;
      break;
    case 'booking.paid':
      increments.paymentsSucceeded = 1;
      increments.paymentVolume = paymentVolume;
      break;
    case 'payment.failed':
      increments.paymentsFailed = 1;
      break;
    case 'booking.ticketing.failed':
      increments.ticketingFailed = 1;
      break;
    case 'ticket.issued':
      increments.ticketsIssued = 1;
      break;
    case 'flight.delayed':
      increments.flightsDelayed = 1;
      break;
    case 'flight.cancelled':
      increments.flightsCancelled = 1;
      break;
    default:
      break;
  }

  return increments;
}

export function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function formatAnalyticsDateLabel(value: Date): string {
  return value.toISOString().slice(0, 10);
}
