import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/redis.service';
import {
  BOOKING_MAINTENANCE_LOCK_KEY,
  BOOKING_MAINTENANCE_LOCK_TTL_SECONDS,
} from '../constants/scheduler.constants';

@Injectable()
export class SchedulerLockService {
  constructor(private readonly redis: RedisService) {}

  async tryAcquireBookingMaintenanceLock(): Promise<boolean> {
    return this.redis.setIfNotExists(
      BOOKING_MAINTENANCE_LOCK_KEY,
      { acquiredAt: new Date().toISOString() },
      BOOKING_MAINTENANCE_LOCK_TTL_SECONDS,
    );
  }
}
