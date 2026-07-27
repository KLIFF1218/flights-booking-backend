import { Module } from '@nestjs/common';
import { DomainAnalyticsService } from './domain-analytics.service';

@Module({
  providers: [DomainAnalyticsService],
  exports: [DomainAnalyticsService],
})
export class DomainAnalyticsModule {}
