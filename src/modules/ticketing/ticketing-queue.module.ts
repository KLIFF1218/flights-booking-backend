import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ticketingQueueConfig } from './ticketing-queue.config';
import { TicketingEnqueueService } from './services/ticketing-enqueue.service';

@Module({
  imports: [BullModule.registerQueue(ticketingQueueConfig)],
  providers: [TicketingEnqueueService],
  exports: [BullModule, TicketingEnqueueService],
})
export class TicketingQueueModule {}
