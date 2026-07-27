import { parseRabbitRouting } from './outbox-rabbit.util';

describe('parseRabbitRouting', () => {
  it('splits exchange and routing key on the first colon', () => {
    expect(parseRabbitRouting('booking.events:booking.paid')).toEqual({
      exchange: 'booking.events',
      routingKey: 'booking.paid',
    });
  });

  it('supports routing keys with colons', () => {
    expect(parseRabbitRouting('booking.events:payment.reconciliation:refunded')).toEqual({
      exchange: 'booking.events',
      routingKey: 'payment.reconciliation:refunded',
    });
  });
});
