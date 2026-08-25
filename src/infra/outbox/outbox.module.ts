import { Module, forwardRef } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { RabbitmqModule } from 'src/infra/rabbitmq/rabbitmq.module';
import { KafkaModule } from 'src/infra/kafka/kafka.module';
import { OutboxProcessor } from './outbox.processor';
import { PaymentOutboxHandlersModule } from 'src/modules/payment/payment-outbox-handlers.module';
import { TicketingOutboxHandlersModule } from 'src/modules/ticketing/ticketing-outbox-handlers.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { BookingsOutboxHandlersModule } from 'src/modules/bookings/bookings-outbox-handlers.module';

@Module({
  imports: [
    PrismaModule,
    RabbitmqModule,
    KafkaModule,
    PaymentOutboxHandlersModule,
    TicketingOutboxHandlersModule,
    forwardRef(() => BookingsOutboxHandlersModule),
    BookingMetricsModule,
  ],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService, OutboxProcessor],
})
export class OutboxModule {}
