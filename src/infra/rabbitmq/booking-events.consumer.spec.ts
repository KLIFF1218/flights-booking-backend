import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { BookingEventsConsumer } from './booking-events.consumer';
import { TicketingEnqueueService } from 'src/modules/ticketing/services/ticketing-enqueue.service';
import { MetricsService } from '../metrics/metrics.service';

describe('BookingEventsConsumer', () => {
  let consumer: BookingEventsConsumer;

  const ticketingEnqueue = {
    enqueueIssueTicket: jest.fn(),
  };
  const metrics = {
    recordRabbitConsume: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingEventsConsumer,
        { provide: TicketingEnqueueService, useValue: ticketingEnqueue },
        { provide: Logger, useValue: { log: jest.fn(), debug: jest.fn() } },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    consumer = module.get(BookingEventsConsumer);
  });

  it('enqueues ticketing when booking.paid event is consumed', async () => {
    ticketingEnqueue.enqueueIssueTicket.mockResolvedValue(undefined);

    await consumer.onBookingPaid({ bookingId: 'booking-1' });

    expect(ticketingEnqueue.enqueueIssueTicket).toHaveBeenCalledWith('booking-1');
    expect(metrics.recordRabbitConsume).toHaveBeenCalledWith('booking.paid', 'success');
  });

  it('records failure metric and rethrows when enqueue fails', async () => {
    ticketingEnqueue.enqueueIssueTicket.mockRejectedValue(new Error('queue unavailable'));

    await expect(consumer.onBookingPaid({ bookingId: 'booking-2' })).rejects.toThrow(
      'queue unavailable',
    );

    expect(metrics.recordRabbitConsume).toHaveBeenCalledWith('booking.paid', 'failure');
  });
});
