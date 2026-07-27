import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { BookingEventsPublisher } from './booking-events.publisher';
import { MetricsService } from '../metrics/metrics.service';

describe('BookingEventsPublisher', () => {
  let publisher: BookingEventsPublisher;

  const amqpConnection = {
    publish: jest.fn(),
  };
  const metrics = {
    recordRabbitPublish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingEventsPublisher,
        {
          provide: AmqpConnection,
          useValue: amqpConnection,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('booking.events'),
          },
        },
        {
          provide: MetricsService,
          useValue: metrics,
        },
      ],
    }).compile();

    publisher = module.get(BookingEventsPublisher);
  });

  it('publishBookingPaid sends booking.paid routing key', async () => {
    amqpConnection.publish.mockResolvedValue(undefined);

    await publisher.publishBookingPaid('booking-1');

    expect(amqpConnection.publish).toHaveBeenCalledWith(
      'booking.events',
      'booking.paid',
      expect.objectContaining({
        bookingId: 'booking-1',
        occurredAt: expect.any(String),
      }),
    );
    expect(metrics.recordRabbitPublish).toHaveBeenCalledWith('booking.paid', 'success');
  });

  it('publishBookingCanceled sends booking.canceled routing key', async () => {
    amqpConnection.publish.mockResolvedValue(undefined);

    await publisher.publishBookingCanceled('booking-2');

    expect(amqpConnection.publish).toHaveBeenCalledWith(
      'booking.events',
      'booking.canceled',
      expect.objectContaining({ bookingId: 'booking-2' }),
    );
  });

  it('records failure metric and rethrows when publish fails', async () => {
    amqpConnection.publish.mockRejectedValue(new Error('broker down'));

    await expect(
      publisher.publishRaw('booking.events', 'booking.paid', { bookingId: 'booking-3' }),
    ).rejects.toThrow('broker down');

    expect(metrics.recordRabbitPublish).toHaveBeenCalledWith('booking.paid', 'failure');
  });
});
