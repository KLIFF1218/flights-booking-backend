import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from 'nestjs-pino';

type BookingMailJob = {
  email: string;
  bookingId: string;
  pdfUrl?: string;
};

@Processor('mail')
@Injectable()
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly mailer: MailerService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<BookingMailJob>) {
    const { email, bookingId, pdfUrl } = job.data;

    try {
      switch (job.name) {
        case 'send-booking-success':
          await this.mailer.sendMail({
            to: email,
            subject: 'Ваш электронный билет готов ✈️',
            template: 'booking-success',
            context: { bookingId },
            attachments: pdfUrl
              ? [
                  {
                    filename: `Ticket-${bookingId}.pdf`,
                    path: pdfUrl,
                    contentType: 'application/pdf',
                  },
                ]
              : [],
          });
          break;

        case 'send-booking-failed':
          await this.mailer.sendMail({
            to: email,
            subject: 'Ошибка оформления бронирования',
            template: 'booking-failed',
            context: { bookingId },
          });
          break;

        default:
          this.logger.warn({ jobName: job.name }, 'Unknown mail job');
      }

      this.logger.log({ jobId: job.id, bookingId }, 'Mail sent successfully');
    } catch (error) {
      this.logger.error(
        {
          error: error.message,
          jobName: job.name,
          bookingId,
        },
        'Mail sending failed',
      );

      throw error;
    }
  }
}
