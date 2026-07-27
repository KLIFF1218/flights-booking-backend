import { Module, Global } from '@nestjs/common';
import { KafkaPublisher } from './kafka.publisher';
import { BookingAuditConsumer } from './booking-audit.consumer';
import { BookingNotificationsConsumer } from './booking-notifications.consumer';
import { BookingAnalyticsConsumer } from './booking-analytics.consumer';
import { DomainEventsModule } from 'src/infra/domain-events/domain-events.module';
import { BookingNotificationsModule } from 'src/infra/notifications/booking-notifications.module';
import { DomainAnalyticsModule } from 'src/infra/analytics/domain-analytics.module';

@Global()
@Module({
  imports: [DomainEventsModule, BookingNotificationsModule, DomainAnalyticsModule],
  providers: [
    KafkaPublisher,
    BookingAuditConsumer,
    BookingNotificationsConsumer,
    BookingAnalyticsConsumer,
  ],
  exports: [KafkaPublisher],
})
export class KafkaModule {}
