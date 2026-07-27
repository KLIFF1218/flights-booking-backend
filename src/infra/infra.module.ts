import { Module } from '@nestjs/common';
import { PrismaModule } from './db/prisma/prisma.module';
import { RateLimiterModule } from './rate-limiter/rate-limiter.module';
import { MailModule } from './mail/mail.module';
import { PdfModule } from './pdf/pdf.module';
import { S3Module } from './storage/s3.module';

@Module({
  imports: [PrismaModule, RateLimiterModule, MailModule, PdfModule, S3Module],
})
export class InfraModule {}
