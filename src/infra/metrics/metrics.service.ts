import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private _flightSearchCounter: Counter | null = null;
  private _flightSearchDuration: Histogram | null = null;

  private _bookingCounter: Counter | null = null;
  private _bookingValueCounter: Counter | null = null;
  private _bookingDuration: Histogram | null = null;
  private _cancellationCounter: Counter | null = null;

  private _paymentCounter: Counter | null = null;
  private _paymentValueCounter: Counter | null = null;
  private _paymentDuration: Histogram | null = null;
  private _paymentFailureCounter: Counter | null = null;
  private _paymentMethodCounter: Counter | null = null;
  private _webhookReceivedCounter: Counter | null = null;
  private _webhookProcessedCounter: Counter | null = null;
  private _webhookIgnoredCounter: Counter | null = null;
  private _paymentIdempotencyConflictCounter: Counter | null = null;
  private _paymentAbandonedCounter: Counter | null = null;

  private _loginCounter: Counter | null = null;
  private _loginFailureCounter: Counter | null = null;
  private _authTokenIssueDuration: Histogram | null = null;
  private _authRefreshCounter: Counter | null = null;
  private _authLogoutCounter: Counter | null = null;

  private _seatsAvailableGauge: Gauge | null = null;
  private _seatHoldDuration: Histogram | null = null;
  private _seatReleaseCounter: Counter | null = null;

  private _emailsEnqueuedCounter: Counter | null = null;
  private _emailsSentCounter: Counter | null = null;
  private _emailsFailedCounter: Counter | null = null;
  private _notificationDelayHistogram: Histogram | null = null;

  private _ticketingEnqueuedCounter: Counter | null = null;
  private _ticketingCompletedCounter: Counter | null = null;
  private _ticketingFailedCounter: Counter | null = null;
  private _ticketingDuration: Histogram | null = null;

  private _kafkaPublishCounter: Counter | null = null;
  private _rabbitPublishCounter: Counter | null = null;
  private _rabbitConsumeCounter: Counter | null = null;

  private _redisLockCounter: Counter | null = null;
  private _redisCacheCounter: Counter | null = null;

  private _rateLimitCounter: Counter | null = null;
  private _adminActionCounter: Counter | null = null;
  private _healthUpGauge: Gauge | null = null;

  get flightSearchCounter(): Counter {
    if (!this._flightSearchCounter) {
      this._flightSearchCounter = new Counter({
        name: 'maxairline_search_total',
        help: 'Total number of flight searches',
        labelNames: ['origin', 'destination', 'status'],
        registers: [register],
      });
    }
    return this._flightSearchCounter;
  }

  get flightSearchDuration(): Histogram {
    if (!this._flightSearchDuration) {
      this._flightSearchDuration = new Histogram({
        name: 'maxairline_search_duration_seconds',
        help: 'Flight search duration in seconds',
        labelNames: ['origin', 'status'],
        buckets: [0.5, 1, 2, 5, 10],
        registers: [register],
      });
    }
    return this._flightSearchDuration;
  }

  get bookingCounter(): Counter {
    if (!this._bookingCounter) {
      this._bookingCounter = new Counter({
        name: 'maxairline_bookings_total',
        help: 'Total number of bookings',
        labelNames: ['status', 'airline'],
        registers: [register],
      });
    }
    return this._bookingCounter;
  }

  get bookingValueCounter(): Counter {
    if (!this._bookingValueCounter) {
      this._bookingValueCounter = new Counter({
        name: 'maxairline_booking_value_total',
        help: 'Total booking value in cents',
        labelNames: ['currency', 'airline'],
        registers: [register],
      });
    }
    return this._bookingValueCounter;
  }

  get bookingDuration(): Histogram {
    if (!this._bookingDuration) {
      this._bookingDuration = new Histogram({
        name: 'maxairline_booking_duration_seconds',
        help: 'Booking creation duration in seconds',
        labelNames: ['status'],
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        registers: [register],
      });
    }
    return this._bookingDuration;
  }

  get cancellationCounter(): Counter {
    if (!this._cancellationCounter) {
      this._cancellationCounter = new Counter({
        name: 'maxairline_cancellations_total',
        help: 'Total number of booking cancellations',
        labelNames: ['reason', 'airline'],
        registers: [register],
      });
    }
    return this._cancellationCounter;
  }

  get paymentCounter(): Counter {
    if (!this._paymentCounter) {
      this._paymentCounter = new Counter({
        name: 'maxairline_payments_total',
        help: 'Total number of payments by lifecycle status',
        labelNames: ['provider', 'status'],
        registers: [register],
      });
    }
    return this._paymentCounter;
  }

  get paymentValueCounter(): Counter {
    if (!this._paymentValueCounter) {
      this._paymentValueCounter = new Counter({
        name: 'maxairline_payments_value_total',
        help: 'Total payment amount in cents',
        labelNames: ['provider', 'status'],
        registers: [register],
      });
    }
    return this._paymentValueCounter;
  }

  get paymentDuration(): Histogram {
    if (!this._paymentDuration) {
      this._paymentDuration = new Histogram({
        name: 'maxairline_payment_duration_seconds',
        help: 'Payment initiation duration in seconds',
        labelNames: ['provider'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
        registers: [register],
      });
    }
    return this._paymentDuration;
  }

  get paymentFailureCounter(): Counter {
    if (!this._paymentFailureCounter) {
      this._paymentFailureCounter = new Counter({
        name: 'maxairline_payment_failures_total',
        help: 'Total number of failed payment initiations',
        labelNames: ['provider', 'reason'],
        registers: [register],
      });
    }
    return this._paymentFailureCounter;
  }

  get paymentMethodCounter(): Counter {
    if (!this._paymentMethodCounter) {
      this._paymentMethodCounter = new Counter({
        name: 'maxairline_payment_method_total',
        help: 'Confirmed payments by method',
        labelNames: ['method', 'provider'],
        registers: [register],
      });
    }
    return this._paymentMethodCounter;
  }

  get webhookReceivedCounter(): Counter {
    if (!this._webhookReceivedCounter) {
      this._webhookReceivedCounter = new Counter({
        name: 'maxairline_payment_webhooks_received_total',
        help: 'Payment webhooks received',
        labelNames: ['provider'],
        registers: [register],
      });
    }
    return this._webhookReceivedCounter;
  }

  get webhookProcessedCounter(): Counter {
    if (!this._webhookProcessedCounter) {
      this._webhookProcessedCounter = new Counter({
        name: 'maxairline_payment_webhooks_processed_total',
        help: 'Payment webhooks processed',
        labelNames: ['provider', 'outcome'],
        registers: [register],
      });
    }
    return this._webhookProcessedCounter;
  }

  get webhookIgnoredCounter(): Counter {
    if (!this._webhookIgnoredCounter) {
      this._webhookIgnoredCounter = new Counter({
        name: 'maxairline_payment_webhooks_ignored_total',
        help: 'Payment webhooks ignored',
        labelNames: ['provider', 'reason'],
        registers: [register],
      });
    }
    return this._webhookIgnoredCounter;
  }

  get paymentIdempotencyConflictCounter(): Counter {
    if (!this._paymentIdempotencyConflictCounter) {
      this._paymentIdempotencyConflictCounter = new Counter({
        name: 'maxairline_payment_idempotency_conflicts_total',
        help: 'Duplicate payment webhook events',
        labelNames: ['provider'],
        registers: [register],
      });
    }
    return this._paymentIdempotencyConflictCounter;
  }

  get paymentAbandonedCounter(): Counter {
    if (!this._paymentAbandonedCounter) {
      this._paymentAbandonedCounter = new Counter({
        name: 'maxairline_payment_abandoned_total',
        help: 'Abandoned pending payments',
        labelNames: ['provider', 'result'],
        registers: [register],
      });
    }
    return this._paymentAbandonedCounter;
  }

  get loginCounter(): Counter {
    if (!this._loginCounter) {
      this._loginCounter = new Counter({
        name: 'maxairline_login_total',
        help: 'Total login attempts',
        labelNames: ['method'],
        registers: [register],
      });
    }
    return this._loginCounter;
  }

  get loginFailureCounter(): Counter {
    if (!this._loginFailureCounter) {
      this._loginFailureCounter = new Counter({
        name: 'maxairline_login_failures_total',
        help: 'Total failed login attempts',
        labelNames: ['method', 'reason'],
        registers: [register],
      });
    }
    return this._loginFailureCounter;
  }

  get authTokenIssueDuration(): Histogram {
    if (!this._authTokenIssueDuration) {
      this._authTokenIssueDuration = new Histogram({
        name: 'maxairline_auth_token_issue_duration_seconds',
        help: 'Auth token issuance latency in seconds',
        labelNames: ['token_type'],
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
        registers: [register],
      });
    }
    return this._authTokenIssueDuration;
  }

  /** @deprecated Use authTokenIssueDuration — kept for getter compatibility during migration */
  get authTokenDuration(): Histogram {
    return this.authTokenIssueDuration;
  }

  get authRefreshCounter(): Counter {
    if (!this._authRefreshCounter) {
      this._authRefreshCounter = new Counter({
        name: 'maxairline_auth_refresh_total',
        help: 'Auth refresh token operations',
        labelNames: ['status'],
        registers: [register],
      });
    }
    return this._authRefreshCounter;
  }

  get authLogoutCounter(): Counter {
    if (!this._authLogoutCounter) {
      this._authLogoutCounter = new Counter({
        name: 'maxairline_auth_logout_total',
        help: 'Auth logout operations',
        labelNames: ['scope'],
        registers: [register],
      });
    }
    return this._authLogoutCounter;
  }

  get seatsAvailableGauge(): Gauge {
    if (!this._seatsAvailableGauge) {
      this._seatsAvailableGauge = new Gauge({
        name: 'maxairline_seats_available',
        help: 'Available seats by aircraft type',
        labelNames: ['aircraft_type'],
        registers: [register],
      });
    }
    return this._seatsAvailableGauge;
  }

  get seatHoldDuration(): Histogram {
    if (!this._seatHoldDuration) {
      this._seatHoldDuration = new Histogram({
        name: 'maxairline_seat_hold_duration_seconds',
        help: 'Seat hold duration in seconds',
        labelNames: ['status'],
        buckets: [60, 300, 900, 1800, 3600],
        registers: [register],
      });
    }
    return this._seatHoldDuration;
  }

  get seatReleaseCounter(): Counter {
    if (!this._seatReleaseCounter) {
      this._seatReleaseCounter = new Counter({
        name: 'maxairline_seat_releases_total',
        help: 'Total seat releases',
        labelNames: ['reason'],
        registers: [register],
      });
    }
    return this._seatReleaseCounter;
  }

  get emailsEnqueuedCounter(): Counter {
    if (!this._emailsEnqueuedCounter) {
      this._emailsEnqueuedCounter = new Counter({
        name: 'maxairline_emails_enqueued_total',
        help: 'Emails enqueued to the mail queue',
        labelNames: ['type'],
        registers: [register],
      });
    }
    return this._emailsEnqueuedCounter;
  }

  get emailsSentCounter(): Counter {
    if (!this._emailsSentCounter) {
      this._emailsSentCounter = new Counter({
        name: 'maxairline_emails_sent_total',
        help: 'Total emails successfully sent',
        labelNames: ['type', 'status'],
        registers: [register],
      });
    }
    return this._emailsSentCounter;
  }

  get emailsFailedCounter(): Counter {
    if (!this._emailsFailedCounter) {
      this._emailsFailedCounter = new Counter({
        name: 'maxairline_emails_failed_total',
        help: 'Total failed email sends',
        labelNames: ['type', 'reason'],
        registers: [register],
      });
    }
    return this._emailsFailedCounter;
  }

  get notificationDelayHistogram(): Histogram {
    if (!this._notificationDelayHistogram) {
      this._notificationDelayHistogram = new Histogram({
        name: 'maxairline_notification_delay_seconds',
        help: 'Notification delivery delay in seconds',
        labelNames: ['type'],
        buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
        registers: [register],
      });
    }
    return this._notificationDelayHistogram;
  }

  get ticketingEnqueuedCounter(): Counter {
    if (!this._ticketingEnqueuedCounter) {
      this._ticketingEnqueuedCounter = new Counter({
        name: 'maxairline_ticketing_jobs_enqueued_total',
        help: 'Ticketing jobs enqueued',
        registers: [register],
      });
    }
    return this._ticketingEnqueuedCounter;
  }

  get ticketingCompletedCounter(): Counter {
    if (!this._ticketingCompletedCounter) {
      this._ticketingCompletedCounter = new Counter({
        name: 'maxairline_ticketing_jobs_completed_total',
        help: 'Ticketing jobs completed',
        registers: [register],
      });
    }
    return this._ticketingCompletedCounter;
  }

  get ticketingFailedCounter(): Counter {
    if (!this._ticketingFailedCounter) {
      this._ticketingFailedCounter = new Counter({
        name: 'maxairline_ticketing_jobs_failed_total',
        help: 'Ticketing jobs failed',
        labelNames: ['reason'],
        registers: [register],
      });
    }
    return this._ticketingFailedCounter;
  }

  get ticketingDuration(): Histogram {
    if (!this._ticketingDuration) {
      this._ticketingDuration = new Histogram({
        name: 'maxairline_ticketing_job_duration_seconds',
        help: 'Ticketing job processing duration',
        buckets: [0.5, 1, 2, 5, 10, 30, 60],
        registers: [register],
      });
    }
    return this._ticketingDuration;
  }

  get kafkaPublishCounter(): Counter {
    if (!this._kafkaPublishCounter) {
      this._kafkaPublishCounter = new Counter({
        name: 'maxairline_kafka_publish_total',
        help: 'Kafka publish attempts',
        labelNames: ['topic', 'status'],
        registers: [register],
      });
    }
    return this._kafkaPublishCounter;
  }

  get rabbitPublishCounter(): Counter {
    if (!this._rabbitPublishCounter) {
      this._rabbitPublishCounter = new Counter({
        name: 'maxairline_rabbitmq_publish_total',
        help: 'RabbitMQ publish attempts',
        labelNames: ['routing_key', 'status'],
        registers: [register],
      });
    }
    return this._rabbitPublishCounter;
  }

  get rabbitConsumeCounter(): Counter {
    if (!this._rabbitConsumeCounter) {
      this._rabbitConsumeCounter = new Counter({
        name: 'maxairline_rabbitmq_consume_total',
        help: 'RabbitMQ consume attempts',
        labelNames: ['routing_key', 'status'],
        registers: [register],
      });
    }
    return this._rabbitConsumeCounter;
  }

  get redisLockCounter(): Counter {
    if (!this._redisLockCounter) {
      this._redisLockCounter = new Counter({
        name: 'maxairline_redis_lock_total',
        help: 'Redis lock acquire attempts',
        labelNames: ['lock', 'result'],
        registers: [register],
      });
    }
    return this._redisLockCounter;
  }

  get redisCacheCounter(): Counter {
    if (!this._redisCacheCounter) {
      this._redisCacheCounter = new Counter({
        name: 'maxairline_redis_cache_total',
        help: 'Redis cache lookups',
        labelNames: ['cache', 'result'],
        registers: [register],
      });
    }
    return this._redisCacheCounter;
  }

  get rateLimitCounter(): Counter {
    if (!this._rateLimitCounter) {
      this._rateLimitCounter = new Counter({
        name: 'maxairline_rate_limit_total',
        help: 'Rate limiter decisions',
        labelNames: ['key_prefix', 'result'],
        registers: [register],
      });
    }
    return this._rateLimitCounter;
  }

  get adminActionCounter(): Counter {
    if (!this._adminActionCounter) {
      this._adminActionCounter = new Counter({
        name: 'maxairline_admin_actions_total',
        help: 'Admin mutation actions',
        labelNames: ['action', 'result'],
        registers: [register],
      });
    }
    return this._adminActionCounter;
  }

  get healthUpGauge(): Gauge {
    if (!this._healthUpGauge) {
      this._healthUpGauge = new Gauge({
        name: 'maxairline_health_up',
        help: 'Dependency health (1=up, 0=down)',
        labelNames: ['check'],
        registers: [register],
      });
    }
    return this._healthUpGauge;
  }

  recordFlightSearch(origin: string, destination: string, status: string) {
    this.flightSearchCounter.labels(origin, destination, status).inc();
  }

  recordFlightSearchDuration(duration: number, origin: string, status: string) {
    this.flightSearchDuration.labels(origin, status).observe(duration);
  }

  recordBooking(status: string, airline: string) {
    this.bookingCounter.labels(status, airline).inc();
  }

  recordBookingValue(value: number, currency: string, airline: string) {
    this.bookingValueCounter.labels(currency, airline).inc(value);
  }

  recordBookingDuration(duration: number, status: string) {
    this.bookingDuration.labels(status).observe(duration);
  }

  recordCancellation(reason: string, airline: string) {
    this.cancellationCounter.labels(reason, airline).inc();
  }

  recordPayment(provider: string, status: string) {
    this.paymentCounter.labels(provider, status).inc();
  }

  recordPaymentValue(value: number, provider: string, status: string) {
    this.paymentValueCounter.labels(provider, status).inc(value);
  }

  recordPaymentDuration(duration: number, provider: string) {
    this.paymentDuration.labels(provider).observe(duration);
  }

  recordPaymentFailure(provider: string, reason: string) {
    this.paymentFailureCounter.labels(provider, reason).inc();
  }

  recordPaymentMethod(method: string, provider: string) {
    this.paymentMethodCounter.labels(method, provider).inc();
  }

  recordWebhookReceived(provider: string) {
    this.webhookReceivedCounter.labels(provider).inc();
  }

  recordWebhookProcessed(provider: string, outcome: string) {
    this.webhookProcessedCounter.labels(provider, outcome).inc();
  }

  recordWebhookIgnored(provider: string, reason: string) {
    this.webhookIgnoredCounter.labels(provider, reason).inc();
  }

  recordPaymentIdempotencyConflict(provider: string) {
    this.paymentIdempotencyConflictCounter.labels(provider).inc();
  }

  recordPaymentAbandoned(provider: string, result: string) {
    this.paymentAbandonedCounter.labels(provider, result).inc();
  }

  recordLogin(method: string) {
    this.loginCounter.labels(method).inc();
  }

  recordLoginFailure(method: string, reason: string) {
    this.loginFailureCounter.labels(method, reason).inc();
  }

  recordAuthTokenDuration(duration: number, tokenType: string) {
    this.authTokenIssueDuration.labels(tokenType).observe(duration);
  }

  recordAuthRefresh(status: string) {
    this.authRefreshCounter.labels(status).inc();
  }

  recordAuthLogout(scope: string) {
    this.authLogoutCounter.labels(scope).inc();
  }

  updateSeatsAvailable(available: number, aircraftType: string) {
    this.seatsAvailableGauge.labels(aircraftType).set(available);
  }

  recordSeatHoldDuration(duration: number, status: string) {
    this.seatHoldDuration.labels(status).observe(duration);
  }

  recordSeatRelease(reason: string) {
    this.seatReleaseCounter.labels(reason).inc();
  }

  recordEmailEnqueued(type: string) {
    this.emailsEnqueuedCounter.labels(type).inc();
  }

  recordEmailSent(type: string, status = 'sent') {
    this.emailsSentCounter.labels(type, status).inc();
  }

  recordEmailFailed(type: string, reason: string) {
    this.emailsFailedCounter.labels(type, reason).inc();
  }

  recordNotificationDelay(delay: number, type: string) {
    this.notificationDelayHistogram.labels(type).observe(delay);
  }

  recordTicketingEnqueued() {
    this.ticketingEnqueuedCounter.inc();
  }

  recordTicketingCompleted() {
    this.ticketingCompletedCounter.inc();
  }

  recordTicketingFailed(reason: string) {
    this.ticketingFailedCounter.labels(reason).inc();
  }

  recordTicketingDuration(duration: number) {
    this.ticketingDuration.observe(duration);
  }

  recordKafkaPublish(topic: string, status: string) {
    this.kafkaPublishCounter.labels(topic, status).inc();
  }

  recordRabbitPublish(routingKey: string, status: string) {
    this.rabbitPublishCounter.labels(routingKey, status).inc();
  }

  recordRabbitConsume(routingKey: string, status: string) {
    this.rabbitConsumeCounter.labels(routingKey, status).inc();
  }

  recordRedisLock(lock: string, result: string) {
    this.redisLockCounter.labels(lock, result).inc();
  }

  recordRedisCache(cache: string, result: string) {
    this.redisCacheCounter.labels(cache, result).inc();
  }

  recordRateLimit(keyPrefix: string, result: string) {
    this.rateLimitCounter.labels(keyPrefix, result).inc();
  }

  recordAdminAction(action: string, result: string) {
    this.adminActionCounter.labels(action, result).inc();
  }

  setHealthUp(check: string, up: boolean) {
    this.healthUpGauge.labels(check).set(up ? 1 : 0);
  }
}
