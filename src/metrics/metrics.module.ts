import { Module, Global } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from '../infra/metrics/metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
