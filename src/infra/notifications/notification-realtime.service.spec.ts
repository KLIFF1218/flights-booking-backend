import { NotificationRealtimeService } from './notification-realtime.service';
import { NOTIFICATION_REDIS_CHANNEL_PREFIX } from './notification-realtime.constants';

describe('NotificationRealtimeService', () => {
  const publish = jest.fn().mockResolvedValue(1);
  const redis = {
    getClient: jest.fn(() => ({ publish })),
  };
  const config = {
    get: jest.fn((_key: string, defaultValue?: number) => defaultValue),
  };
  const logger = { warn: jest.fn() };

  const service = new NotificationRealtimeService(redis as never, config as never, logger as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes notification.created on user channel', async () => {
    await service.publishCreated('user-1', {
      notificationId: 'notif-1',
      notificationType: 'BOOKING_CREATED',
    });

    expect(publish).toHaveBeenCalledWith(
      `${NOTIFICATION_REDIS_CHANNEL_PREFIX}user-1`,
      JSON.stringify({
        type: 'notification.created',
        notificationId: 'notif-1',
        notificationType: 'BOOKING_CREATED',
      }),
    );
  });

  it('builds per-user redis channel names', () => {
    expect(service.userChannel('abc')).toBe(`${NOTIFICATION_REDIS_CHANNEL_PREFIX}abc`);
  });
});
