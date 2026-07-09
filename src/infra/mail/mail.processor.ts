import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from 'nestjs-pino';

type BookingMailJob = {
  email: string;
  bookingId: string;
  tickets?: {
    travelerId: string;
    ticketNumber: string;
    downloadUrl: string;
  }[];
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
          const attachments =
            tickets?.map((ticket) => ({
              filename: `Ticket-${ticket.ticketNumber}.pdf`,
              href: ticket.downloadUrl,
              contentType: 'application/pdf',
            })) || [];

          await this.mailer.sendMail({
            to: email,
            subject: 'Ваш электронный билет готов ✈️',
            template: 'booking-success',
            context: {
              bookingId,
              tickets: job.data.tickets,
            },
            attachments,
          });

          break;
        }

        case 'send-booking-failed': {
          await this.mailer.sendMail({
            to: email,
            subject: 'Ошибка оформления бронирования',
            template: 'booking-failed',
            context: { bookingId },
          });
          break;
        }

        default: {
          this.logger.warn({ jobName: job.name }, 'Unknown mail job');
          break;
        }
      }

      this.logger.log({ jobId: job.id, bookingId }, 'Mail sent successfully');
    } catch (error) {
      this.logger.error(
        {
          err: error,
          jobName: job.name,
          bookingId,
        },
        'Mail sending failed',
      );

      throw error;
    }
  }
}
