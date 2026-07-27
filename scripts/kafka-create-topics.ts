import { Kafka, logLevel } from 'kafkajs';

const DEFAULT_TOPICS = [
  'booking.created',
  'booking.paid',
  'booking.canceled',
  'ticket.issued',
  'payment.failed',
  'flight.delayed',
  'flight.cancelled',
];

async function main() {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(',');
  const topics = (process.env.KAFKA_DOMAIN_TOPICS ?? DEFAULT_TOPICS.join(','))
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID ?? 'max-airline',
    brokers,
    logLevel: logLevel.NOTHING,
  });

  const admin = kafka.admin();

  await admin.connect();

  const existing = new Set(await admin.listTopics());

  for (const topic of topics) {
    if (existing.has(topic)) {
      console.log(`Topic already exists: ${topic}`);
      continue;
    }

    await admin.createTopics({
      topics: [{ topic, numPartitions: 3, replicationFactor: 1 }],
    });
    console.log(`Created topic: ${topic}`);
  }

  await admin.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
