import { Controller, Get, Param, Patch, Post, Query, Sse, type MessageEvent } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Observable } from 'rxjs';
import { Authorized, Protected, Roles } from 'src/common/decorators';
import { ApiBadRequestError, ApiUserAuthErrors } from 'src/common/swagger/api-responses.decorator';
import { UserNotificationsService } from '../user-notifications.service';
import { UserNotificationResponseDto } from '../dtos/user-notification-response.dto';
import { ListNotificationsQueryDto } from '../dtos/list-notifications-query.dto';
import { MarkAllNotificationsReadResponseDto } from '../dtos/mark-all-notifications-read-response.dto';
import { UnreadNotificationsCountDto } from '../dtos/unread-notifications-count.dto';

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'users/me/notifications', version: '1' })
export class UserNotificationsController {
  constructor(private readonly notificationsService: UserNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List user notifications' })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiOkResponse({ type: [UserNotificationResponseDto], description: 'Notifications retrieved' })
  list(@Authorized('id') userId: string, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listForUser(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiUserAuthErrors()
  @ApiOkResponse({ type: UnreadNotificationsCountDto })
  async unreadCount(@Authorized('id') userId: string): Promise<UnreadNotificationsCountDto> {
    const count = await this.notificationsService.countUnread(userId);
    return { count };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiUserAuthErrors()
  @ApiOkResponse({ type: UserNotificationResponseDto })
  markRead(@Authorized('id') userId: string, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markRead(userId, notificationId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiUserAuthErrors()
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  markAllRead(@Authorized('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Sse('stream')
  @ApiOperation({
    summary: 'Realtime notification stream (SSE)',
    description:
      'Server-sent events for in-app notifications. Emits notification.created after Kafka consumer persists a notification.',
  })
  @ApiUserAuthErrors()
  stream(@Authorized('id') userId: string): Observable<MessageEvent> {
    return this.notificationsService.streamForUser(userId);
  }
}
