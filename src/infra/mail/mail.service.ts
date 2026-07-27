import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';
import { MetricsService } from '../metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('mail') private readonly queue: Queue,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {}

  async sendBookingSuccess(
    user: { email: string },
    bookingId: string,
    tickets: {
      travelerId: string;
      ticketNumber: string;
      pdfKey: string;
    }[],
  ) {
    await this.queue.add(
      'send-booking-success',
      {
        email: user.email,
        bookingId,
        tickets,
      },
      {
        jobId: `mail:booking-success:${bookingId}`,
        removeOnComplete: true,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    );
    runSafely(() => this.metrics.recordEmailEnqueued('booking_success'));
  }

  async sendBookingFailed(user: { email: string }, bookingId: string) {
    await this.queue.add(
      'send-booking-failed',
      {
        email: user.email,
        bookingId,
      },
      {
        jobId: `mail:booking-failed:${bookingId}`,
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    );

    this.logger.log({ bookingId }, 'Booking failed email enqueued');
    runSafely(() => this.metrics.recordEmailEnqueued('booking_failed'));
  }
}
