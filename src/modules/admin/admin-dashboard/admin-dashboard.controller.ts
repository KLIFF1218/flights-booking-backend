import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardStatsDto } from './dtos/admin-dashboard-stats.dto';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { ApiAdminAuthErrors } from 'src/common/swagger/api-responses.decorator';
import { DomainAnalyticsService } from 'src/infra/analytics/domain-analytics.service';

@ApiTags('Admin / Dashboard')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/dashboard', version: '1' })
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly domainAnalytics: DomainAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiOkResponse({ description: 'Statistics retrieved successfully', type: DashboardStatsDto })
  @ApiAdminAuthErrors()
  async getDashboard(): Promise<DashboardStatsDto> {
    return this.adminDashboardService.getDashboardStats();
  }

  @Post('analytics/rebuild')
  @ApiOperation({
    summary: 'Rebuild event analytics projection from DomainEvent log',
    description: 'Development/maintenance endpoint. Replays persisted domain events.',
  })
  @ApiAdminAuthErrors()
  async rebuildEventAnalytics() {
    return this.domainAnalytics.rebuildFromDomainEvents();
  }
}
