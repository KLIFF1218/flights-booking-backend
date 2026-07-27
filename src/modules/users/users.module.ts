import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './controllers/users.controller';
import { SavedPassengersController } from './controllers/saved-passengers.controller';
import { SavedPassengersService } from './saved-passengers.service';
import { SavedPassengerMapper } from './mappers/saved-passenger.mapper';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsController } from './controllers/user-notifications.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationRealtimeModule } from 'src/infra/notifications/notification-realtime.module';

@Module({
  imports: [forwardRef(() => AuthModule), NotificationRealtimeModule],
  controllers: [UsersController, SavedPassengersController, UserNotificationsController],
  providers: [UsersService, SavedPassengersService, SavedPassengerMapper, UserNotificationsService],
  exports: [UsersService, UserNotificationsService],
})
export class UsersModule {}
