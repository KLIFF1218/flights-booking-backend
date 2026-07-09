import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { getMailerConfig } from 'src/config/mailer.config';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';
import { MetricsModule } from 'src/infra/metrics/metrics.module';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: getMailerConfig,
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'mail',
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
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
