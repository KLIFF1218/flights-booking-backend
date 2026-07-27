import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

import { TicketingQueueModule } from 'src/modules/ticketing/ticketing-queue.module';
import { BookingEventsPublisher } from './booking-events.publisher';
import { BookingEventsConsumer } from './booking-events.consumer';
import { RabbitmqShutdownService } from './rabbitmq-shutdown.service';

@Module({
  imports: [
    TicketingQueueModule,
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
  providers: [BookingEventsPublisher, BookingEventsConsumer, RabbitmqShutdownService],
  exports: [BookingEventsPublisher, RabbitMQModule],
})
export class RabbitmqModule {}
