import { register } from 'prom-client';
import { BookingMetricsService } from './booking-metrics.service';
import { type MetricsService } from 'src/infra/metrics/metrics.service';

describe('BookingMetricsService', () => {
  let service: BookingMetricsService;
  const metrics = {
    recordBooking: jest.fn(),
    recordBookingDuration: jest.fn(),
    recordCancellation: jest.fn(),
    recordSeatRelease: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    register.clear();
    service = new BookingMetricsService(metrics as unknown as MetricsService);
  });

  it('records booking creation with bounded labels', async () => {
    service.recordBookingCreated('MOCK', 'PNR_CREATED', 'SU');
    service.observeBookingCreationDuration(0.5, 'MOCK', 'SU');

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toContain('maxairline_booking_created_total');
    expect(metricsOutput).toContain('provider="MOCK"');
    expect(metricsOutput).toContain('status="PNR_CREATED"');
    expect(metricsOutput).toContain('airline="SU"');
    expect(metricsOutput).toContain('maxairline_booking_creation_duration_seconds');
    expect(metrics.recordBooking).toHaveBeenCalledWith('PNR_CREATED', 'SU');
  });

  it('records checkout failure with bounded stage and reason', async () => {
    service.recordCheckoutStarted();
    service.recordCheckoutFailed('payment', 'status_conflict');
    service.recordCheckoutRollback('payment');

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toContain('maxairline_booking_checkout_started_total');
    expect(metricsOutput).toContain('maxairline_booking_checkout_failed_total');
    expect(metricsOutput).toContain('stage="payment"');
    expect(metricsOutput).toContain('reason="status_conflict"');
    expect(metricsOutput).toContain('maxairline_booking_checkout_rollback_total');
  });

  it('records outbox metrics with normalized topic labels', async () => {
    service.recordOutboxEnqueued('payment.pending.cancel', 'INTERNAL');
    service.recordOutboxSent('payment.pending.cancel', 'INTERNAL');

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toContain('maxairline_booking_outbox_enqueued_total');
    expect(metricsOutput).toContain('topic="payment.pending.cancel"');
    expect(metricsOutput).toContain('transport="INTERNAL"');
    expect(metricsOutput).toContain('maxairline_booking_outbox_sent_total');
  });

  it('records cache and maintenance metrics', async () => {
    service.recordCacheHit('user_list');
    service.recordCacheMiss('booking_detail');
    service.recordCacheInvalidation('user_list');
    service.recordMaintenanceRun('expire_bookings', 'success');
    service.observeMaintenanceDuration('expire_bookings', 1.2);
    service.recordMaintenanceItemsProcessed('expire_bookings', 3);

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toContain('maxairline_booking_cache_hit_total');
    expect(metricsOutput).toContain('cache="user_list"');
    expect(metricsOutput).toContain('maxairline_booking_cache_miss_total');
    expect(metricsOutput).toContain('maxairline_booking_maintenance_run_total');
    expect(metricsOutput).toContain('job="expire_bookings"');
    expect(metricsOutput).toContain('result="success"');
  });
});
