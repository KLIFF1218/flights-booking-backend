import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';

@Injectable()
export class BullmqShutdownService implements OnApplicationShutdown {
  constructor(
    @InjectQueue('ticketing') private readonly ticketingQueue: Queue,
    @InjectQueue('mail') private readonly mailQueue: Queue,
    private readonly logger: Logger,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log({ signal }, 'Closing BullMQ queues');

    const results = await Promise.allSettled([this.ticketingQueue.close(), this.mailQueue.close()]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(
          {
            err: result.reason instanceof Error ? result.reason : String(result.reason),
          },
          'BullMQ queue close failed',
        );
      }
    }

    this.logger.log('BullMQ queues closed');
  }
}
