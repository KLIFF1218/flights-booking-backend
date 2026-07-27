import { Module } from '@nestjs/common';
import { TicketingService } from './services/ticketing.service';
import { TicketIssuerService } from './services/ticket-issuer.service';
import { PdfModule } from 'src/infra/pdf/pdf.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { TicketingProcessor } from './ticketing.processor';
import { MailModule } from 'src/infra/mail/mail.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { BookingsCacheModule } from '../bookings/bookings-cache.module';
import { TicketingQueueModule } from './ticketing-queue.module';
import { BookingMetricsModule } from '../bookings/metrics/booking-metrics.module';

@Module({
  imports: [
    TicketingQueueModule,
    PdfModule,
    S3Module,
    MailModule,
    OutboxModule,
    BookingsCacheModule,
    BookingMetricsModule,
  ],
  providers: [TicketingService, TicketIssuerService, TicketingProcessor],
  exports: [TicketingQueueModule, TicketingService],
})
export class TicketingModule {}
