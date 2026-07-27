import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { ResendMailService } from './resend-mail.service';
import { S3Module } from 'src/infra/storage/s3.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail',
      forceDisconnectOnShutdown: true,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
        removeOnComplete: true,
        removeOnFail: {
          age: 60 * 60 * 24 * 7,
        },
      },
    }),
    MetricsModule,
    S3Module,
  ],
  providers: [MailService, MailProcessor, ResendMailService],
  exports: [MailService, BullModule],
})
export class MailModule {}
