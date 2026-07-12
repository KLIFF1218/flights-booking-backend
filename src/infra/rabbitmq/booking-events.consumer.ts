import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { TicketingService } from 'src/modules/ticketing/services/ticketing.service';
import { Logger } from 'nestjs-pino';
import 'dotenv/config';

@Injectable()
export class BookingEventsConsumer implements OnModuleInit {
  constructor(
    private readonly ticketingService: TicketingService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    this.logger.log('RabbitMQ booking consumer initialized');
  }

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE!,
    routingKey: 'booking.paid',
    queue: process.env.RABBITMQ_QUEUE!,
    createQueueIfNotExists: true,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': process.env.RABBITMQ_DLX!,
      },
    },
  })
  async onBookingPaid(message: { bookingId: string }) {
    this.logger.log({ bookingId: message.bookingId }, 'RabbitMQ received booking.paid');
    await this.ticketingService.issueTicket(message.bookingId);
  }
}
