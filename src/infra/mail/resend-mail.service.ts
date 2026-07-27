import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Resend } from 'resend';
import { getResendConfig } from 'src/config/resend.config';
import { S3Service } from 'src/infra/storage/s3.service';
import { renderBookingFailedEmail } from './templates/booking-failed.template';
import { renderBookingSuccessEmail } from './templates/booking-success.template';

const EMAIL_DOWNLOAD_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

type TicketAttachmentInput = {
  travelerId: string;
  ticketNumber: string;
  pdfKey: string;
};

@Injectable()
export class ResendMailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(
    configService: ConfigService,
    private readonly s3: S3Service,
    private readonly logger: Logger,
  ) {
    const config = getResendConfig(configService);
    this.resend = new Resend(config.apiKey);
    this.from = config.from;
  }

  async sendBookingSuccess(
    email: string,
    bookingId: string,
    tickets: TicketAttachmentInput[],
  ): Promise<void> {
    const ticketsWithUrls = await Promise.all(
      tickets.map(async (ticket) => {
        const downloadUrl = await this.s3.getDownloadUrl(ticket.pdfKey, {
          disposition: 'attachment',
          fileName: `Ticket-${ticket.ticketNumber}.pdf`,
          expiresIn: EMAIL_DOWNLOAD_URL_EXPIRES_IN_SECONDS,
        });

        return {
          ticketNumber: ticket.ticketNumber,
          downloadUrl,
        };
      }),
    );

    const attachments = await this.downloadTicketAttachments(tickets);

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: [email],
      subject: 'Your e-ticket is ready ✈️',
      html: renderBookingSuccessEmail(bookingId, ticketsWithUrls),
      attachments,
    });

    if (error) {
      throw new Error(`Resend booking success email failed: ${error.message}`);
    }
  }

  async sendBookingFailed(email: string, bookingId: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: [email],
      subject: 'Booking processing failed',
      html: renderBookingFailedEmail(bookingId),
    });

    if (error) {
      throw new Error(`Resend booking failed email failed: ${error.message}`);
    }
  }

  private async downloadTicketAttachments(tickets: TicketAttachmentInput[]) {
    const attachments = await Promise.all(
      tickets.map(async (ticket) => {
        const content = await this.s3.getFileBuffer(ticket.pdfKey);

        return {
          filename: `Ticket-${ticket.ticketNumber}.pdf`,
          content,
        };
      }),
    );

    this.logger.debug({ count: attachments.length }, 'Downloaded ticket PDF attachments for email');

    return attachments;
  }
}
