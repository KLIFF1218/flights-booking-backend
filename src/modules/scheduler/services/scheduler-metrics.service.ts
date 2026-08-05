import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import type { BookingMaintenanceStep } from '../constants/scheduler.constants';

@Injectable()
export class SchedulerMetricsService {
  private _maintenancePipelineStepFailedCounter: Counter | null = null;

  constructor(private readonly metrics: MetricsService) {}

  recordMaintenancePipelineStepFailed(step: BookingMaintenanceStep): void {
    runSafely(() => this.maintenancePipelineStepFailedCounter.labels(step).inc());
  }

  private get maintenancePipelineStepFailedCounter(): Counter {
    if (!this._maintenancePipelineStepFailedCounter) {
      this._maintenancePipelineStepFailedCounter = new Counter({
        name: 'maxairline_scheduler_maintenance_pipeline_step_failed_total',
        help: 'Scheduler booking maintenance pipeline steps that failed',
        labelNames: ['step'],
        registers: [register],
      });
    }

    return this._maintenancePipelineStepFailedCounter;
  }
}
