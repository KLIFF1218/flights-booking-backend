export const NOTIFICATION_REDIS_CHANNEL_PREFIX = 'notifications:user:';

export type NotificationRealtimePayload =
  | {
      type: 'notification.created';
      notificationId: string;
      notificationType: string;
    }
  | {
      type: 'heartbeat';
    };
