import type { RegisterQueueOptions } from '@nestjs/bullmq';
import { TICKETING_QUEUE_MAX_ATTEMPTS } from './constants/ticketing-queue.constants';

export const TICKETING_QUEUE_NAME = 'ticketing';

export const ticketingQueueConfig: RegisterQueueOptions = {
  name: TICKETING_QUEUE_NAME,
  forceDisconnectOnShutdown: true,
  defaultJobOptions: {
    attempts: TICKETING_QUEUE_MAX_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 30_000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};
