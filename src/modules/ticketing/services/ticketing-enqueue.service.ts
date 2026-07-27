import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import { TICKETING_QUEUE_NAME } from '../ticketing-queue.config';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class TicketingEnqueueService {
  constructor(
    @InjectQueue(TICKETING_QUEUE_NAME)
    private readonly queue: Queue,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {}

  async enqueueIssueTicket(bookingId: string): Promise<void> {
    await this.queue.add(
      'issue-ticket',
      { bookingId },
      {
        jobId: `ticket-${bookingId}`,
      },
    );

    runSafely(() => this.metrics.recordTicketingEnqueued());

    logBookingFlowStage(this.logger, BookingFlowStage.BULLMQ_ENQUEUED, {
      bookingId,
      queue: TICKETING_QUEUE_NAME,
      jobName: 'issue-ticket',
    });
  }
}
