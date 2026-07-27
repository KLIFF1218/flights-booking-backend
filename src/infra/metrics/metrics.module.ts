import { Module, Global } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsBootstrapService } from './metrics-bootstrap.service';
import { MetricsAuthGuard } from 'src/common/guards/metrics-auth.guard';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsBootstrapService, MetricsAuthGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
