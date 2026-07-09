import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Logger } from 'nestjs-pino';
import { MetricsService } from '../metrics/metrics.service';

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
      downloadUrl: string;
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
    try {
      this.metrics.recordEmailSent('booking_success', 'queued');
    } catch {
      this.logger.warn(error, 'Failed to record metrics');
    }
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
    try {
      this.metrics.recordEmailFailed('booking_failed', 'enqueued');
    } catch {
      this.logger.warn(error, 'Failed to record metrics');
    }
  }
}
