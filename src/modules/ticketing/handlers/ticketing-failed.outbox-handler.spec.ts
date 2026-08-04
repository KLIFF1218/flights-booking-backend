import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { TicketingFailedOutboxHandler } from './ticketing-failed.outbox-handler';
import { PaymentAbandonmentService } from 'src/modules/payment/services/payment-abandonment.service';
import { BookingMetricsService } from 'src/modules/bookings/metrics/booking-metrics.service';
import { createBookingMetricsMock } from 'src/modules/bookings/metrics/booking-metrics.mock';

describe('TicketingFailedOutboxHandler', () => {
  let handler: TicketingFailedOutboxHandler;
  let module: TestingModule;
  const paymentAbandonment = { compensateTicketingFailure: jest.fn() };
  const metrics = createBookingMetricsMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        TicketingFailedOutboxHandler,
        { provide: PaymentAbandonmentService, useValue: paymentAbandonment },
        { provide: BookingMetricsService, useValue: metrics },
        { provide: Logger, useValue: { error: jest.fn() } },
      ],
    }).compile();

    handler = module.get(TicketingFailedOutboxHandler);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('compensates ticketing failure and records metric', async () => {
    await handler.handle({
      bookingId: 'b1',
      userId: 'u1',
      reason: 'S3_UPLOAD_FAILED',
    });

    expect(paymentAbandonment.compensateTicketingFailure).toHaveBeenCalledWith(
      'b1',
      'S3_UPLOAD_FAILED',
    );
    expect(metrics.recordTicketingFailureEscalated).toHaveBeenCalledWith('S3_UPLOAD_FAILED');
  });
});
