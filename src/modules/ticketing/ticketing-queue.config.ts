import type { RegisterQueueOptions } from '@nestjs/bullmq';

export const TICKETING_QUEUE_NAME = 'ticketing';

export const ticketingQueueConfig: RegisterQueueOptions = {
  name: TICKETING_QUEUE_NAME,
  forceDisconnectOnShutdown: true,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};
