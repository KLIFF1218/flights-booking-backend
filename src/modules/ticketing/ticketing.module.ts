import { Module } from '@nestjs/common';
import { TicketingService } from './services/ticketing.service';
import { TicketingController } from './controllers/ticketing.controller';
import { BullModule } from '@nestjs/bullmq';
import { PdfModule } from 'src/infra/pdf/pdf.module';
import { S3Module } from 'src/infra/storage/s3.module';
import { TicketingProcessor } from './ticketing.processor';
import { MailModule } from 'src/infra/mail/mail.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ticketing',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30_000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    PdfModule,
    S3Module,
    MailModule,
    OutboxModule,
  ],
  controllers: [TicketingController],
  providers: [TicketingService, TicketingProcessor],
  exports: [BullModule, TicketingService],
})
export class TicketingModule {}
