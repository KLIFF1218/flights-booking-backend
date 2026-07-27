import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ResendMailService } from './resend-mail.service';
import { MetricsService } from '../metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import {
  normalizeMailFailureReason,
  normalizeMailType,
} from '../metrics/normalize-metric-reason.util';

type BookingMailJob = {
  email: string;
  bookingId: string;
  tickets?: {
    travelerId: string;
    ticketNumber: string;
    pdfKey: string;
  }[];
};

@Processor('mail')
@Injectable()
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly resendMail: ResendMailService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<BookingMailJob>) {
    const mailType = normalizeMailType(job.name);
    const delaySeconds = (Date.now() - job.timestamp) / 1000;

    this.logger.log(
      {
        createdAt: new Date(job.timestamp).toISOString(),
        processedAt: new Date().toISOString(),
        delayMs: Date.now() - job.timestamp,
      },
      'Processing mail job',
    );

    const { email, bookingId, tickets } = job.data;

    try {
      switch (job.name) {
        case 'send-booking-success': {
          await this.resendMail.sendBookingSuccess(email, bookingId, tickets ?? []);
          break;
        }

        case 'send-booking-failed': {
          await this.resendMail.sendBookingFailed(email, bookingId);
          break;
        }

        default: {
          this.logger.warn({ jobName: job.name }, 'Unknown mail job');
          return;
        }
      }

      runSafely(() => {
        this.metrics.recordEmailSent(mailType, 'sent');
        this.metrics.recordNotificationDelay(delaySeconds, mailType);
      });

      this.logger.log({ jobId: job.id, bookingId }, 'Mail sent successfully');
    } catch (error: unknown) {
      runSafely(() => {
        this.metrics.recordEmailFailed(mailType, normalizeMailFailureReason(error));
        this.metrics.recordNotificationDelay(delaySeconds, mailType);
      });

      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          jobName: job.name,
          bookingId,
        },
        'Mail sending failed',
      );

      throw error;
    }
  }
}
