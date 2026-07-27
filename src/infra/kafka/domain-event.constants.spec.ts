import {
  DEFAULT_KAFKA_DOMAIN_TOPICS,
  isKafkaDomainTopic,
  KAFKA_DOMAIN_TOPICS,
  parseKafkaDomainTopics,
} from './domain-event.constants';

describe('domain-event.constants', () => {
  it('recognizes configured kafka domain topics', () => {
    expect(isKafkaDomainTopic('booking.paid')).toBe(true);
    expect(isKafkaDomainTopic('unknown.topic')).toBe(false);
  });

  it('parses comma-separated topic list from env string', () => {
    expect(parseKafkaDomainTopics('booking.paid, payment.failed ,invalid')).toEqual([
      'booking.paid',
      'payment.failed',
    ]);
  });

  it('falls back to default topic list when env is blank', () => {
    expect(parseKafkaDomainTopics('   ')).toEqual([...KAFKA_DOMAIN_TOPICS]);
    expect(parseKafkaDomainTopics(undefined)).toEqual([...KAFKA_DOMAIN_TOPICS]);
    expect(DEFAULT_KAFKA_DOMAIN_TOPICS.split(',')).toHaveLength(KAFKA_DOMAIN_TOPICS.length);
  });
});
