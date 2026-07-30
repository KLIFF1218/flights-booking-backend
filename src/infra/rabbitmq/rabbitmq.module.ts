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
      useFactory: (config: ConfigService) => {
        const explicitWait = config.get<string>('RABBITMQ_CONNECTION_WAIT');
        const waitForConnection =
          explicitWait === 'true' ||
          (explicitWait !== 'false' && config.getOrThrow<string>('NODE_ENV') === 'production');

        return {
          uri: config.getOrThrow<string>('RABBITMQ_URI'),

          exchanges: [
            {
              name: config.getOrThrow<string>('RABBITMQ_EXCHANGE'),
              type: 'topic',
              durable: true,
            },
          ],

          connectionInitOptions: {
            wait: waitForConnection,
          },

          enableDirectReplyTo: false,
        };
      },
    }),
  ],
  providers: [BookingEventsPublisher, BookingEventsConsumer, RabbitmqShutdownService],
  exports: [BookingEventsPublisher, RabbitMQModule],
})
export class RabbitmqModule {}
