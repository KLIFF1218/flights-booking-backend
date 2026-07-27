import { Injectable, type MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { redisConfig } from 'src/config/redis.config';
import { RedisService } from 'src/infra/redis/redis.service';
import {
  NOTIFICATION_REDIS_CHANNEL_PREFIX,
  type NotificationRealtimePayload,
} from './notification-realtime.constants';

const DEFAULT_HEARTBEAT_MS = 25_000;

@Injectable()
export class NotificationRealtimeService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  userChannel(userId: string): string {
    return `${NOTIFICATION_REDIS_CHANNEL_PREFIX}${userId}`;
  }

  async publishCreated(
    userId: string,
    payload: { notificationId: string; notificationType: string },
  ): Promise<void> {
    const message: NotificationRealtimePayload = {
      type: 'notification.created',
      notificationId: payload.notificationId,
      notificationType: payload.notificationType,
    };

    try {
      await this.redis.getClient().publish(this.userChannel(userId), JSON.stringify(message));
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error), userId },
        'Failed to publish notification realtime event',
      );
    }
  }

  stream(userId: string): Observable<MessageEvent> {
    const heartbeatMs = this.config.get<number>(
      'NOTIFICATION_SSE_HEARTBEAT_MS',
      DEFAULT_HEARTBEAT_MS,
    );

    return new Observable<MessageEvent>((subscriber) => {
      const channel = this.userChannel(userId);
      const redisSubscriber = new Redis({
        ...redisConfig(this.config),
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });

      let heartbeatTimer: NodeJS.Timeout | undefined;
      let closed = false;

      const cleanup = async () => {
        if (closed) {
          return;
        }

        closed = true;

        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }

        try {
          await redisSubscriber.unsubscribe(channel);
        } catch {
          // ignore unsubscribe errors during teardown
        }

        try {
          await redisSubscriber.quit();
        } catch {
          redisSubscriber.disconnect();
        }
      };

      void (async () => {
        try {
          await redisSubscriber.connect();
          await redisSubscriber.subscribe(channel);

          redisSubscriber.on('message', (_receivedChannel, message) => {
            subscriber.next({ data: message });
          });

          heartbeatTimer = setInterval(() => {
            const heartbeat: NotificationRealtimePayload = { type: 'heartbeat' };
            subscriber.next({ data: JSON.stringify(heartbeat) });
          }, heartbeatMs);
        } catch (error) {
          subscriber.error(error);
          await cleanup();
        }
      })();

      return () => {
        void cleanup();
      };
    });
  }
}
