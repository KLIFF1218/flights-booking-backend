jest.mock('prom-client', () => ({
  collectDefaultMetrics: jest.fn(),
  register: {},
}));

import { collectDefaultMetrics } from 'prom-client';
import { MetricsBootstrapService } from './metrics-bootstrap.service';

describe('MetricsBootstrapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (MetricsBootstrapService as unknown as { initialized: boolean }).initialized = false;
  });

  it('should initialize default metrics only once', () => {
    const service = new MetricsBootstrapService();

    service.onModuleInit();
    service.onModuleInit();

    expect(collectDefaultMetrics).toHaveBeenCalledTimes(1);
    expect(collectDefaultMetrics).toHaveBeenCalledWith({ register: {} });
  });
});
