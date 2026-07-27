import { Module } from '@nestjs/common';
import { BookingNotificationsService } from './booking-notifications.service';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [BookingNotificationsService],
  exports: [BookingNotificationsService],
})
export class BookingNotificationsModule {}
