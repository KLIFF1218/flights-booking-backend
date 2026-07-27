import { Module } from '@nestjs/common';
import { NotificationRealtimeService } from './notification-realtime.service';

@Module({
  providers: [NotificationRealtimeService],
  exports: [NotificationRealtimeService],
})
export class NotificationRealtimeModule {}
