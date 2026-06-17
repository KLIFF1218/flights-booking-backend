import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

import { TicketingModule } from 'src/modules/ticketing/ticketing.module';
import { BookingEventsPublisher } from './booking-events.publisher';
import { BookingEventsConsumer } from './booking-events.consumer';

@Module({
  imports: [
    TicketingModule,
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: `amqp://${config.get('RABBITMQ_USER', 'guest')}:${config.get('RABBITMQ_PASSWORD', 'guest')}@${config.get('RABBITMQ_HOST', 'localhost')}:${config.get('RABBITMQ_PORT', 5672)}`,
        exchanges: [
          {
            name: config.get('RABBITMQ_EXCHANGE', 'booking.events'),
            type: 'topic',
            durable: true,
          },
        ],
        connectionInitOptions: { wait: false },
        enableDirectReplyTo: false,
      }),
    }),
  ],
  providers: [BookingEventsPublisher, BookingEventsConsumer],
  exports: [BookingEventsPublisher],
})
export class RabbitmqModule {}
