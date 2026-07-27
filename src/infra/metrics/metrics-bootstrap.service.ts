import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

@Injectable()
export class MetricsBootstrapService implements OnModuleInit {
  private static initialized = false;

  onModuleInit(): void {
    if (MetricsBootstrapService.initialized) {
      return;
    }

    collectDefaultMetrics({ register });
    MetricsBootstrapService.initialized = true;
  }
}
