import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';

/** Slim outbox for e2e — persists rows without Kafka/Rabbit processors. */
@Module({
  imports: [PrismaModule, BookingMetricsModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxE2eModule {}
