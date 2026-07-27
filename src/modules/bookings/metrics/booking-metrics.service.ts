import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import type {
  BookingCacheName,
  BookingCheckoutStage,
  BookingMaintenanceJob,
  BookingMetricReason,
  BookingOperationName,
} from './booking-metrics.constants';
import { normalizeBookingOutboxTopic } from './booking-metrics-reason.util';

@Injectable()
export class BookingMetricsService {
  private _bookingCreatedCounter: Counter | null = null;
  private _bookingCreationDuration: Histogram | null = null;
  private _bookingExpiredCounter: Counter | null = null;
  private _bookingCanceledCounter: Counter | null = null;
  private _bookingOperationFailedCounter: Counter | null = null;
  private _createCompensationFailedCounter: Counter | null = null;
  private _ticketingFailureEscalatedCounter: Counter | null = null;
  private _ticketingFailureEscalationFailedCounter: Counter | null = null;

  private _checkoutStartedCounter: Counter | null = null;
  private _checkoutCompletedCounter: Counter | null = null;
  private _checkoutFailedCounter: Counter | null = null;
  private _checkoutDuration: Histogram | null = null;
  private _checkoutRollbackCounter: Counter | null = null;

  private _travelersAddedCounter: Counter | null = null;
  private _travelerValidationFailedCounter: Counter | null = null;

  private _seatAssignmentCounter: Counter | null = null;
  private _seatAssignmentDuration: Histogram | null = null;
  private _seatAssignmentFailedCounter: Counter | null = null;
  private _seatHoldRefreshedCounter: Counter | null = null;
  private _seatReleaseCounter: Counter | null = null;

  private _inventoryReservedCounter: Counter | null = null;
  private _inventoryReleasedCounter: Counter | null = null;
  private _inventoryReservationFailedCounter: Counter | null = null;

  private _outboxEnqueuedCounter: Counter | null = null;
  private _outboxSentCounter: Counter | null = null;
  private _outboxRetryCounter: Counter | null = null;
  private _outboxFailedCounter: Counter | null = null;

  private _maintenanceRunCounter: Counter | null = null;
  private _maintenanceDuration: Histogram | null = null;
  private _maintenanceItemsProcessedCounter: Counter | null = null;

  private _cacheHitCounter: Counter | null = null;
  private _cacheMissCounter: Counter | null = null;
  private _cacheInvalidationCounter: Counter | null = null;

  private _ticketDownloadCounter: Counter | null = null;

  constructor(private readonly metrics: MetricsService) {}

  recordBookingCreated(provider: string, status: string, airline: string): void {
    runSafely(() => {
      this.bookingCreatedCounter.labels(provider, status, airline).inc();
      this.metrics.recordBooking(status, airline);
    });
  }

  observeBookingCreationDuration(durationSeconds: number, provider: string, airline: string): void {
    runSafely(() => {
      this.bookingCreationDuration.labels(provider, airline).observe(durationSeconds);
      this.metrics.recordBookingDuration(durationSeconds, 'created');
    });
  }

  recordBookingExpired(reason: string): void {
    runSafely(() => this.bookingExpiredCounter.labels(reason).inc());
  }

  recordBookingCanceled(reason: string, statusBefore: string, airline: string): void {
    runSafely(() => {
      this.bookingCanceledCounter.labels(reason, statusBefore).inc();
      this.metrics.recordCancellation(reason, airline);
    });
  }

  recordOperationFailed(operation: BookingOperationName, reason: BookingMetricReason): void {
    runSafely(() => this.bookingOperationFailedCounter.labels(operation, reason).inc());
  }

  recordCreateCompensationFailed(): void {
    runSafely(() => this.createCompensationFailedCounter.inc());
  }

  recordTicketingFailureEscalated(reason: string): void {
    runSafely(() => this.ticketingFailureEscalatedCounter.labels(reason).inc());
  }

  recordTicketingFailureEscalationFailed(reason: string): void {
    runSafely(() => this.ticketingFailureEscalationFailedCounter.labels(reason).inc());
  }

  recordCheckoutStarted(): void {
    runSafely(() => this.checkoutStartedCounter.inc());
  }

  recordCheckoutCompleted(): void {
    runSafely(() => this.checkoutCompletedCounter.inc());
  }

  recordCheckoutFailed(stage: BookingCheckoutStage, reason: BookingMetricReason): void {
    runSafely(() => this.checkoutFailedCounter.labels(stage, reason).inc());
  }

  observeCheckoutDuration(durationSeconds: number): void {
    runSafely(() => this.checkoutDuration.observe(durationSeconds));
  }

  recordCheckoutRollback(stage: BookingCheckoutStage): void {
    runSafely(() => this.checkoutRollbackCounter.labels(stage).inc());
  }

  recordTravelersAdded(): void {
    runSafely(() => this.travelersAddedCounter.inc());
  }

  recordTravelerValidationFailed(reason: BookingMetricReason): void {
    runSafely(() => this.travelerValidationFailedCounter.labels(reason).inc());
  }

  recordSeatAssignment(result: 'success' | 'unchanged'): void {
    runSafely(() => this.seatAssignmentCounter.labels(result).inc());
  }

  observeSeatAssignmentDuration(durationSeconds: number): void {
    runSafely(() => this.seatAssignmentDuration.observe(durationSeconds));
  }

  recordSeatAssignmentFailed(reason: BookingMetricReason): void {
    runSafely(() => this.seatAssignmentFailedCounter.labels(reason).inc());
  }

  recordSeatHoldRefreshed(): void {
    runSafely(() => this.seatHoldRefreshedCounter.inc());
  }

  recordSeatRelease(reason: string): void {
    runSafely(() => this.seatReleaseCounter.labels(reason).inc());
  }

  recordInventoryReserved(): void {
    runSafely(() => this.inventoryReservedCounter.inc());
  }

  recordInventoryReleased(reason: string): void {
    runSafely(() => this.inventoryReleasedCounter.labels(reason).inc());
  }

  recordInventoryReservationFailed(reason: BookingMetricReason): void {
    runSafely(() => this.inventoryReservationFailedCounter.labels(reason).inc());
  }

  recordOutboxEnqueued(topic: string, transport: string): void {
    runSafely(() =>
      this.outboxEnqueuedCounter.labels(normalizeBookingOutboxTopic(topic), transport).inc(),
    );
  }

  recordOutboxSent(topic: string, transport: string): void {
    runSafely(() =>
      this.outboxSentCounter.labels(normalizeBookingOutboxTopic(topic), transport).inc(),
    );
  }

  recordOutboxRetry(topic: string, transport: string): void {
    runSafely(() =>
      this.outboxRetryCounter.labels(normalizeBookingOutboxTopic(topic), transport).inc(),
    );
  }

  recordOutboxFailed(topic: string, transport: string): void {
    runSafely(() =>
      this.outboxFailedCounter.labels(normalizeBookingOutboxTopic(topic), transport).inc(),
    );
  }

  recordMaintenanceRun(job: BookingMaintenanceJob, result: 'success' | 'failure'): void {
    runSafely(() => this.maintenanceRunCounter.labels(job, result).inc());
  }

  observeMaintenanceDuration(job: BookingMaintenanceJob, durationSeconds: number): void {
    runSafely(() => this.maintenanceDuration.labels(job).observe(durationSeconds));
  }

  recordMaintenanceItemsProcessed(job: BookingMaintenanceJob, count: number): void {
    if (count <= 0) {
      return;
    }

    runSafely(() => this.maintenanceItemsProcessedCounter.labels(job).inc(count));
  }

  recordCacheHit(cache: BookingCacheName): void {
    runSafely(() => this.cacheHitCounter.labels(cache).inc());
  }

  recordCacheMiss(cache: BookingCacheName): void {
    runSafely(() => this.cacheMissCounter.labels(cache).inc());
  }

  recordCacheInvalidation(cache: BookingCacheName): void {
    runSafely(() => this.cacheInvalidationCounter.labels(cache).inc());
  }

  recordTicketDownload(result: 'success' | 'not_found' | 'missing_pdf'): void {
    runSafely(() => this.ticketDownloadCounter.labels(result).inc());
  }

  private get bookingCreatedCounter(): Counter {
    if (!this._bookingCreatedCounter) {
      this._bookingCreatedCounter = new Counter({
        name: 'maxairline_booking_created_total',
        help: 'Total bookings created',
        labelNames: ['provider', 'status', 'airline'],
        registers: [register],
      });
    }

    return this._bookingCreatedCounter;
  }

  private get bookingCreationDuration(): Histogram {
    if (!this._bookingCreationDuration) {
      this._bookingCreationDuration = new Histogram({
        name: 'maxairline_booking_creation_duration_seconds',
        help: 'Booking creation duration in seconds',
        labelNames: ['provider', 'airline'],
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        registers: [register],
      });
    }

    return this._bookingCreationDuration;
  }

  private get bookingExpiredCounter(): Counter {
    if (!this._bookingExpiredCounter) {
      this._bookingExpiredCounter = new Counter({
        name: 'maxairline_booking_expired_total',
        help: 'Total bookings expired',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._bookingExpiredCounter;
  }

  private get bookingCanceledCounter(): Counter {
    if (!this._bookingCanceledCounter) {
      this._bookingCanceledCounter = new Counter({
        name: 'maxairline_booking_canceled_total',
        help: 'Total bookings canceled',
        labelNames: ['reason', 'status_before'],
        registers: [register],
      });
    }

    return this._bookingCanceledCounter;
  }

  private get bookingOperationFailedCounter(): Counter {
    if (!this._bookingOperationFailedCounter) {
      this._bookingOperationFailedCounter = new Counter({
        name: 'maxairline_booking_operation_failed_total',
        help: 'Total failed booking operations',
        labelNames: ['operation', 'reason'],
        registers: [register],
      });
    }

    return this._bookingOperationFailedCounter;
  }

  private get createCompensationFailedCounter(): Counter {
    if (!this._createCompensationFailedCounter) {
      this._createCompensationFailedCounter = new Counter({
        name: 'maxairline_booking_create_compensation_failed_total',
        help: 'Total dead-letter failures while compensating a failed booking create workflow',
        registers: [register],
      });
    }

    return this._createCompensationFailedCounter;
  }

  private get ticketingFailureEscalatedCounter(): Counter {
    if (!this._ticketingFailureEscalatedCounter) {
      this._ticketingFailureEscalatedCounter = new Counter({
        name: 'maxairline_booking_ticketing_failure_escalated_total',
        help: 'Total ticketing failures escalated via outbox compensation workflow',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._ticketingFailureEscalatedCounter;
  }

  private get ticketingFailureEscalationFailedCounter(): Counter {
    if (!this._ticketingFailureEscalationFailedCounter) {
      this._ticketingFailureEscalationFailedCounter = new Counter({
        name: 'maxairline_booking_ticketing_failure_escalation_failed_total',
        help: 'Total ticketing failures that could not be escalated',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._ticketingFailureEscalationFailedCounter;
  }

  private get checkoutStartedCounter(): Counter {
    if (!this._checkoutStartedCounter) {
      this._checkoutStartedCounter = new Counter({
        name: 'maxairline_booking_checkout_started_total',
        help: 'Total booking checkouts started',
        registers: [register],
      });
    }

    return this._checkoutStartedCounter;
  }

  private get checkoutCompletedCounter(): Counter {
    if (!this._checkoutCompletedCounter) {
      this._checkoutCompletedCounter = new Counter({
        name: 'maxairline_booking_checkout_completed_total',
        help: 'Total booking checkouts completed',
        registers: [register],
      });
    }

    return this._checkoutCompletedCounter;
  }

  private get checkoutFailedCounter(): Counter {
    if (!this._checkoutFailedCounter) {
      this._checkoutFailedCounter = new Counter({
        name: 'maxairline_booking_checkout_failed_total',
        help: 'Total failed booking checkouts',
        labelNames: ['stage', 'reason'],
        registers: [register],
      });
    }

    return this._checkoutFailedCounter;
  }

  private get checkoutDuration(): Histogram {
    if (!this._checkoutDuration) {
      this._checkoutDuration = new Histogram({
        name: 'maxairline_booking_checkout_duration_seconds',
        help: 'Booking checkout duration in seconds',
        buckets: [0.5, 1, 2, 5, 10, 30],
        registers: [register],
      });
    }

    return this._checkoutDuration;
  }

  private get checkoutRollbackCounter(): Counter {
    if (!this._checkoutRollbackCounter) {
      this._checkoutRollbackCounter = new Counter({
        name: 'maxairline_booking_checkout_rollback_total',
        help: 'Total booking checkout rollbacks',
        labelNames: ['stage'],
        registers: [register],
      });
    }

    return this._checkoutRollbackCounter;
  }

  private get travelersAddedCounter(): Counter {
    if (!this._travelersAddedCounter) {
      this._travelersAddedCounter = new Counter({
        name: 'maxairline_booking_travelers_added_total',
        help: 'Total traveler add operations completed',
        registers: [register],
      });
    }

    return this._travelersAddedCounter;
  }

  private get travelerValidationFailedCounter(): Counter {
    if (!this._travelerValidationFailedCounter) {
      this._travelerValidationFailedCounter = new Counter({
        name: 'maxairline_booking_traveler_validation_failed_total',
        help: 'Total traveler validation failures',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._travelerValidationFailedCounter;
  }

  private get seatAssignmentCounter(): Counter {
    if (!this._seatAssignmentCounter) {
      this._seatAssignmentCounter = new Counter({
        name: 'maxairline_booking_seat_assignment_total',
        help: 'Total seat assignment operations',
        labelNames: ['result'],
        registers: [register],
      });
    }

    return this._seatAssignmentCounter;
  }

  private get seatAssignmentDuration(): Histogram {
    if (!this._seatAssignmentDuration) {
      this._seatAssignmentDuration = new Histogram({
        name: 'maxairline_booking_seat_assignment_duration_seconds',
        help: 'Seat assignment duration in seconds',
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        registers: [register],
      });
    }

    return this._seatAssignmentDuration;
  }

  private get seatAssignmentFailedCounter(): Counter {
    if (!this._seatAssignmentFailedCounter) {
      this._seatAssignmentFailedCounter = new Counter({
        name: 'maxairline_booking_seat_assignment_failed_total',
        help: 'Total failed seat assignment operations',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._seatAssignmentFailedCounter;
  }

  private get seatHoldRefreshedCounter(): Counter {
    if (!this._seatHoldRefreshedCounter) {
      this._seatHoldRefreshedCounter = new Counter({
        name: 'maxairline_booking_seat_hold_refreshed_total',
        help: 'Total seat hold TTL refreshes',
        registers: [register],
      });
    }

    return this._seatHoldRefreshedCounter;
  }

  private get seatReleaseCounter(): Counter {
    if (!this._seatReleaseCounter) {
      this._seatReleaseCounter = new Counter({
        name: 'maxairline_booking_seat_release_total',
        help: 'Total seat releases in booking flow',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._seatReleaseCounter;
  }

  private get inventoryReservedCounter(): Counter {
    if (!this._inventoryReservedCounter) {
      this._inventoryReservedCounter = new Counter({
        name: 'maxairline_booking_inventory_reserved_total',
        help: 'Total booking inventory reservations',
        registers: [register],
      });
    }

    return this._inventoryReservedCounter;
  }

  private get inventoryReleasedCounter(): Counter {
    if (!this._inventoryReleasedCounter) {
      this._inventoryReleasedCounter = new Counter({
        name: 'maxairline_booking_inventory_released_total',
        help: 'Total booking inventory releases',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._inventoryReleasedCounter;
  }

  private get inventoryReservationFailedCounter(): Counter {
    if (!this._inventoryReservationFailedCounter) {
      this._inventoryReservationFailedCounter = new Counter({
        name: 'maxairline_booking_inventory_reservation_failed_total',
        help: 'Total failed booking inventory reservations',
        labelNames: ['reason'],
        registers: [register],
      });
    }

    return this._inventoryReservationFailedCounter;
  }

  private get outboxEnqueuedCounter(): Counter {
    if (!this._outboxEnqueuedCounter) {
      this._outboxEnqueuedCounter = new Counter({
        name: 'maxairline_booking_outbox_enqueued_total',
        help: 'Total booking-related outbox messages enqueued',
        labelNames: ['topic', 'transport'],
        registers: [register],
      });
    }

    return this._outboxEnqueuedCounter;
  }

  private get outboxSentCounter(): Counter {
    if (!this._outboxSentCounter) {
      this._outboxSentCounter = new Counter({
        name: 'maxairline_booking_outbox_sent_total',
        help: 'Total booking-related outbox messages sent',
        labelNames: ['topic', 'transport'],
        registers: [register],
      });
    }

    return this._outboxSentCounter;
  }

  private get outboxRetryCounter(): Counter {
    if (!this._outboxRetryCounter) {
      this._outboxRetryCounter = new Counter({
        name: 'maxairline_booking_outbox_retry_total',
        help: 'Total booking-related outbox message retries',
        labelNames: ['topic', 'transport'],
        registers: [register],
      });
    }

    return this._outboxRetryCounter;
  }

  private get outboxFailedCounter(): Counter {
    if (!this._outboxFailedCounter) {
      this._outboxFailedCounter = new Counter({
        name: 'maxairline_booking_outbox_failed_total',
        help: 'Total permanently failed booking-related outbox messages',
        labelNames: ['topic', 'transport'],
        registers: [register],
      });
    }

    return this._outboxFailedCounter;
  }

  private get maintenanceRunCounter(): Counter {
    if (!this._maintenanceRunCounter) {
      this._maintenanceRunCounter = new Counter({
        name: 'maxairline_booking_maintenance_run_total',
        help: 'Total booking maintenance job runs',
        labelNames: ['job', 'result'],
        registers: [register],
      });
    }

    return this._maintenanceRunCounter;
  }

  private get maintenanceDuration(): Histogram {
    if (!this._maintenanceDuration) {
      this._maintenanceDuration = new Histogram({
        name: 'maxairline_booking_maintenance_duration_seconds',
        help: 'Booking maintenance job duration in seconds',
        labelNames: ['job'],
        buckets: [0.5, 1, 2, 5, 10, 30, 60],
        registers: [register],
      });
    }

    return this._maintenanceDuration;
  }

  private get maintenanceItemsProcessedCounter(): Counter {
    if (!this._maintenanceItemsProcessedCounter) {
      this._maintenanceItemsProcessedCounter = new Counter({
        name: 'maxairline_booking_maintenance_items_processed_total',
        help: 'Total items processed by booking maintenance jobs',
        labelNames: ['job'],
        registers: [register],
      });
    }

    return this._maintenanceItemsProcessedCounter;
  }

  private get cacheHitCounter(): Counter {
    if (!this._cacheHitCounter) {
      this._cacheHitCounter = new Counter({
        name: 'maxairline_booking_cache_hit_total',
        help: 'Total booking cache hits',
        labelNames: ['cache'],
        registers: [register],
      });
    }

    return this._cacheHitCounter;
  }

  private get cacheMissCounter(): Counter {
    if (!this._cacheMissCounter) {
      this._cacheMissCounter = new Counter({
        name: 'maxairline_booking_cache_miss_total',
        help: 'Total booking cache misses',
        labelNames: ['cache'],
        registers: [register],
      });
    }

    return this._cacheMissCounter;
  }

  private get cacheInvalidationCounter(): Counter {
    if (!this._cacheInvalidationCounter) {
      this._cacheInvalidationCounter = new Counter({
        name: 'maxairline_booking_cache_invalidation_total',
        help: 'Total booking cache invalidations',
        labelNames: ['cache'],
        registers: [register],
      });
    }

    return this._cacheInvalidationCounter;
  }

  private get ticketDownloadCounter(): Counter {
    if (!this._ticketDownloadCounter) {
      this._ticketDownloadCounter = new Counter({
        name: 'maxairline_booking_ticket_download_total',
        help: 'Total booking ticket download attempts',
        labelNames: ['result'],
        registers: [register],
      });
    }

    return this._ticketDownloadCounter;
  }
}
