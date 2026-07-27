import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { DomainAnalyticsModule } from 'src/infra/analytics/domain-analytics.module';

@Module({
  imports: [DomainAnalyticsModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
