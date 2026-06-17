import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { RabbitmqModule } from 'src/infra/rabbitmq/rabbitmq.module';
import { KafkaModule } from 'src/infra/kafka/kafka.module';
import { OutboxProcessor } from './outbox.processor';

@Module({
  imports: [PrismaModule, RabbitmqModule, KafkaModule],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}
