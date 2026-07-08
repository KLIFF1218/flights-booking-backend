import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/redis.service';

const DEFAULT_TTL_SECONDS = 30 * 60;

@Injectable()
export class BookingsCacheService {
  private readonly userBookingsPrefix = 'bookings:user';
  private readonly bookingDetailPrefix = 'bookings:detail';

  constructor(private readonly redisService: RedisService) {}

  private userBookingsKey(userId: string): string {
    return `${this.userBookingsPrefix}:${userId}`;
  }

  private bookingDetailKey(bookingId: string): string {
    return `${this.bookingDetailPrefix}:${bookingId}`;
  }

  async saveUserBookings(
    userId: string,
    bookings: unknown[],
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.userBookingsKey(userId), bookings, ttlSeconds);
  }

  async getUserBookings(userId: string): Promise<unknown[] | null> {
    return this.redisService.get<unknown[]>(this.userBookingsKey(userId));
  }

  async deleteUserBookings(userId: string): Promise<number> {
    return this.redisService.delete(this.userBookingsKey(userId));
  }

  async saveBookingDetail(
    bookingId: string,
    booking: unknown,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.bookingDetailKey(bookingId), booking, ttlSeconds);
  }

  async getBookingDetail(bookingId: string): Promise<unknown | null> {
    return this.redisService.get<unknown>(this.bookingDetailKey(bookingId));
  }

  async deleteBookingDetail(bookingId: string): Promise<number> {
    return this.redisService.delete(this.bookingDetailKey(bookingId));
  }
}
