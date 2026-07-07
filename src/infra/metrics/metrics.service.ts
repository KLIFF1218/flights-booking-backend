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

  private _loginCounter: Counter | null = null;
  private _loginFailureCounter: Counter | null = null;
  private _authTokenDuration: Histogram | null = null;

  private _seatsAvailableGauge: Gauge | null = null;
  private _seatHoldDuration: Histogram | null = null;
  private _seatReleaseCounter: Counter | null = null;

  private _emailsSentCounter: Counter | null = null;
  private _emailsFailedCounter: Counter | null = null;
  private _notificationDelayHistogram: Histogram | null = null;

  get flightSearchCounter(): Counter {
    if (!this._flightSearchCounter) {
      this._flightSearchCounter = new Counter({
        name: 'flights_app_search_total',
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
        name: 'flights_app_search_duration_seconds',
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
        name: 'flights_app_bookings_total',
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
        name: 'flights_app_booking_value_total',
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
        name: 'flights_app_booking_duration_seconds',
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
        name: 'flights_app_cancellations_total',
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
        name: 'flights_app_payments_total',
        help: 'Total number of payments',
        labelNames: ['provider', 'status'],
        registers: [register],
      });
    }
    return this._paymentCounter;
  }

  get paymentValueCounter(): Counter {
    if (!this._paymentValueCounter) {
      this._paymentValueCounter = new Counter({
        name: 'flights_app_payments_value_total',
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
        name: 'flights_app_payment_duration_seconds',
        help: 'Payment processing duration in seconds',
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
        name: 'flights_app_payment_failures_total',
        help: 'Total number of failed payments',
        labelNames: ['provider', 'reason'],
        registers: [register],
      });
    }
    return this._paymentFailureCounter;
  }

  get paymentMethodCounter(): Counter {
    if (!this._paymentMethodCounter) {
      this._paymentMethodCounter = new Counter({
        name: 'flights_app_payment_method',
        help: 'Payments by method',
        labelNames: ['method', 'provider'],
        registers: [register],
      });
    }
    return this._paymentMethodCounter;
  }

  get loginCounter(): Counter {
    if (!this._loginCounter) {
      this._loginCounter = new Counter({
        name: 'flights_app_login_total',
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
        name: 'flights_app_login_failures_total',
        help: 'Total failed login attempts',
        labelNames: ['method', 'reason'],
        registers: [register],
      });
    }
    return this._loginFailureCounter;
  }

  get authTokenDuration(): Histogram {
    if (!this._authTokenDuration) {
      this._authTokenDuration = new Histogram({
        name: 'flights_app_auth_token_duration_seconds',
        help: 'Auth token lifetime in seconds',
        labelNames: ['token_type'],
        buckets: [300, 3600, 7200, 86400, 604800],
        registers: [register],
      });
    }
    return this._authTokenDuration;
  }

  get seatsAvailableGauge(): Gauge {
    if (!this._seatsAvailableGauge) {
      this._seatsAvailableGauge = new Gauge({
        name: 'flights_app_seats_available',
        help: 'Available seats by flight',
        labelNames: ['flight_id', 'aircraft_type'],
        registers: [register],
      });
    }
    return this._seatsAvailableGauge;
  }

  get seatHoldDuration(): Histogram {
    if (!this._seatHoldDuration) {
      this._seatHoldDuration = new Histogram({
        name: 'flights_app_seat_hold_duration_seconds',
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
        name: 'flights_app_seat_releases_total',
        help: 'Total seat releases',
        labelNames: ['reason'],
        registers: [register],
      });
    }
    return this._seatReleaseCounter;
  }

  get emailsSentCounter(): Counter {
    if (!this._emailsSentCounter) {
      this._emailsSentCounter = new Counter({
        name: 'flights_app_emails_sent_total',
        help: 'Total emails sent',
        labelNames: ['type', 'status'],
        registers: [register],
      });
    }
    return this._emailsSentCounter;
  }

  get emailsFailedCounter(): Counter {
    if (!this._emailsFailedCounter) {
      this._emailsFailedCounter = new Counter({
        name: 'flights_app_emails_failed_total',
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
        name: 'flights_app_notification_delay_seconds',
        help: 'Notification delivery delay in seconds',
        labelNames: ['type'],
        buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
        registers: [register],
      });
    }
    return this._notificationDelayHistogram;
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

  recordLogin(method: string) {
    this.loginCounter.labels(method).inc();
  }

  recordLoginFailure(method: string, reason: string) {
    this.loginFailureCounter.labels(method, reason).inc();
  }

  recordAuthTokenDuration(duration: number, tokenType: string) {
    this.authTokenDuration.labels(tokenType).observe(duration);
  }

  updateSeatsAvailable(flightId: string, available: number, aircraftType: string) {
    this.seatsAvailableGauge.labels(flightId, aircraftType).set(available);
  }

  recordSeatHoldDuration(duration: number, status: string) {
    this.seatHoldDuration.labels(status).observe(duration);
  }

  recordSeatRelease(reason: string) {
    this.seatReleaseCounter.labels(reason).inc();
  }

  recordEmailSent(type: string, status: string) {
    this.emailsSentCounter.labels(type, status).inc();
  }

  recordEmailFailed(type: string, reason: string) {
    this.emailsFailedCounter.labels(type, reason).inc();
  }

  recordNotificationDelay(delay: number, type: string) {
    this.notificationDelayHistogram.labels(type).observe(delay);
  }
}
