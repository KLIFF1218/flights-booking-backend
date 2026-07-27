import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { TicketingModule } from 'src/modules/ticketing/ticketing.module';
import { ApplicationShutdownService } from './application-shutdown.service';
import { BullmqShutdownService } from './bullmq-shutdown.service';

@Module({
  imports: [TicketingModule, MailModule],
  providers: [ApplicationShutdownService, BullmqShutdownService],
})
export class LifecycleModule {}
