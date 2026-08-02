import { Module, forwardRef } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { RabbitmqModule } from 'src/infra/rabbitmq/rabbitmq.module';
import { KafkaModule } from 'src/infra/kafka/kafka.module';
import { OutboxProcessor } from './outbox.processor';
import { PaymentOutboxHandlersModule } from 'src/modules/payment/payment-outbox-handlers.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { BookingsModule } from 'src/modules/bookings/bookings.module';

@Module({
  imports: [
    PrismaModule,
    RabbitmqModule,
    KafkaModule,
    PaymentOutboxHandlersModule,
    forwardRef(() => BookingsModule),
    BookingMetricsModule,
  ],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService, OutboxProcessor],
})
export class OutboxModule {}
