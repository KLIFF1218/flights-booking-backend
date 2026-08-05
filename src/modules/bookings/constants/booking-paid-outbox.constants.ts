export const BOOKING_PAID_OUTBOX_TOPIC = 'booking.paid';

export function buildBookingPaidRabbitOutboxTopic(
  exchange = process.env.RABBITMQ_EXCHANGE || 'booking.events',
): string {
  return `${exchange}:${BOOKING_PAID_OUTBOX_TOPIC}`;
}
