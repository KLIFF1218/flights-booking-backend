import { Module } from '@nestjs/common';
import { TicketingService } from './services/ticketing.service';
import { TicketIssuerService } from './services/ticket-issuer.service';
import { TicketDocumentService } from './services/ticket-document.service';
import { TicketPersistenceService } from './services/ticket-persistence.service';
import { TicketingFailureHandler } from './services/ticketing-failure.handler';
import { PdfModule } from 'src/infra/pdf/pdf.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { TicketingProcessor } from './services/ticketing.processor';
import { MailModule } from 'src/infra/mail/mail.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';
import { BookingsCacheModule } from '../bookings/bookings-cache.module';
import { TicketingQueueModule } from './ticketing-queue.module';
import { BookingMetricsModule } from '../bookings/metrics/booking-metrics.module';
import { ProcessBookingTicketingUseCase } from './use-cases/process-booking-ticketing.use-case';
import { TicketingOutboxHandlersModule } from './ticketing-outbox-handlers.module';

@Module({
  imports: [
    TicketingQueueModule,
    TicketingOutboxHandlersModule,
    PdfModule,
    S3Module,
    MailModule,
    OutboxModule,
    BookingsCacheModule,
    BookingMetricsModule,
  ],
  providers: [
    TicketingService,
    TicketDocumentService,
    TicketPersistenceService,
    TicketIssuerService,
    TicketingFailureHandler,
    ProcessBookingTicketingUseCase,
    TicketingProcessor,
  ],
  exports: [TicketingQueueModule, TicketingService, TicketingOutboxHandlersModule],
})
export class TicketingModule {}
