import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  uri: process.env.RABBITMQ_URI!,
  exchange: process.env.RABBITMQ_EXCHANGE!,
  queue: process.env.RABBITMQ_QUEUE!,
  deadLetterExchange: process.env.RABBITMQ_DLX!,
  connectionWait:
    process.env.RABBITMQ_CONNECTION_WAIT === 'true' ||
    (process.env.RABBITMQ_CONNECTION_WAIT !== 'false' &&
      process.env.NODE_ENV === 'production'),
}));
