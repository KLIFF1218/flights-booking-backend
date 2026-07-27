export const DOMAIN_EVENT_SCHEMA_VERSION = 1;

export const KAFKA_DOMAIN_TOPICS = [
  'booking.created',
  'booking.expired',
  'booking.paid',
  'booking.canceled',
  'booking.ticketing.failed',
  'ticket.issued',
  'payment.failed',
  'payment.reconciliation.refunded',
  'flight.delayed',
  'flight.cancelled',
] as const;

export type KafkaDomainTopic = (typeof KAFKA_DOMAIN_TOPICS)[number];

export const DEFAULT_KAFKA_DOMAIN_TOPICS = KAFKA_DOMAIN_TOPICS.join(',');

export function isKafkaDomainTopic(topic: string): topic is KafkaDomainTopic {
  return (KAFKA_DOMAIN_TOPICS as readonly string[]).includes(topic);
}

export function parseKafkaDomainTopics(raw: string | undefined): KafkaDomainTopic[] {
  const source = raw?.trim() || DEFAULT_KAFKA_DOMAIN_TOPICS;

  return source
    .split(',')
    .map((topic) => topic.trim())
    .filter((topic): topic is KafkaDomainTopic => isKafkaDomainTopic(topic));
}
