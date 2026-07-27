import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { TicketingEnqueueService } from 'src/modules/ticketing/services/ticketing-enqueue.service';
import { Logger } from 'nestjs-pino';
import { BookingFlowStage, logBookingFlowStage } from 'src/common/logging/booking-flow.logger';
import { MetricsService } from '../metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import 'dotenv/config';

@Injectable()
export class BookingEventsConsumer implements OnModuleInit {
  constructor(
    private readonly ticketingEnqueue: TicketingEnqueueService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
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
    logBookingFlowStage(this.logger, BookingFlowStage.RABBITMQ_RECEIVED, {
      bookingId: message.bookingId,
    });
    try {
      await this.ticketingEnqueue.enqueueIssueTicket(message.bookingId);
      runSafely(() => this.metrics.recordRabbitConsume('booking.paid', 'success'));
    } catch (error) {
      runSafely(() => this.metrics.recordRabbitConsume('booking.paid', 'failure'));
      throw error;
    }
  }
}
