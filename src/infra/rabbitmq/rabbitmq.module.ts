import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

import { TicketingModule } from 'src/modules/ticketing/ticketing.module';
import { BookingEventsPublisher } from './booking-events.publisher';
import { BookingEventsConsumer } from './booking-events.consumer';

@Module({
  imports: [
    forwardRef(() => TicketingModule),
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('RABBITMQ_URI'),

        exchanges: [
          {
            name: config.getOrThrow<string>('RABBITMQ_EXCHANGE'),
            type: 'topic',
            durable: true,
          },
        ],

        connectionInitOptions: {
          wait: false,
        },

        enableDirectReplyTo: false,
      }),
    }),
  ],
  providers: [BookingEventsPublisher, BookingEventsConsumer],
  exports: [BookingEventsPublisher],
})
export class RabbitmqModule {}
