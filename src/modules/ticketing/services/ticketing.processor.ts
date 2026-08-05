import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TICKETING_QUEUE_NAME } from '../ticketing-queue.config';
import { TICKETING_QUEUE_MAX_ATTEMPTS } from '../constants/ticketing-queue.constants';
import { ProcessBookingTicketingUseCase } from '../use-cases/process-booking-ticketing.use-case';
import { TicketingFailureHandler } from './ticketing-failure.handler';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { normalizeTicketingFailureReason } from 'src/infra/metrics/normalize-metric-reason.util';

@Processor(TICKETING_QUEUE_NAME)
export class TicketingProcessor extends WorkerHost {
  constructor(
    private readonly processBookingTicketing: ProcessBookingTicketingUseCase,
    private readonly ticketingFailureHandler: TicketingFailureHandler,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<{ bookingId: string }>) {
    const { bookingId } = job.data;
    const startedAt = Date.now();

    try {
      await this.processBookingTicketing.execute(bookingId);

      runSafely(() => {
        this.metrics.recordTicketingCompleted();
        this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
      });
    } catch (error: unknown) {
      runSafely(() => {
        this.metrics.recordTicketingFailed(normalizeTicketingFailureReason(error));
        this.metrics.recordTicketingDuration((Date.now() - startedAt) / 1000);
      });

      await this.ticketingFailureHandler.handleJobFailure(error, bookingId);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ bookingId: string }>, error: Error) {
    const maxAttempts = job.opts.attempts ?? TICKETING_QUEUE_MAX_ATTEMPTS;

    if (job.attemptsMade < maxAttempts) {
      return;
    }

    await this.ticketingFailureHandler.handleExhaustedRetries(job.data.bookingId, error);
  }
}
