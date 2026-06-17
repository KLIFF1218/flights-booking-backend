import { Module, Global } from '@nestjs/common';
import { KafkaPublisher } from './kafka.publisher';
import { KafkaConsumer } from './kafka.consumer';

@Global()
@Module({
  providers: [KafkaPublisher, KafkaConsumer],
  exports: [KafkaPublisher],
})
export class KafkaModule {}
