import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { RedisService } from 'src/infra/redis/redis.service';
import type { UserBookingsListDto } from '../dtos/user-bookings-list.dto';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import {
  BOOKING_DETAIL_STABLE_TTL_SECONDS,
  resolveBookingDetailCacheTtl,
} from '../utils/booking-cache.util';

const DEFAULT_TTL_SECONDS = BOOKING_DETAIL_STABLE_TTL_SECONDS;

@Injectable()
export class BookingsCacheService {
  private readonly userBookingsPrefix = 'bookings:user';
  private readonly bookingDetailPrefix = 'bookings:detail';

  constructor(
    private readonly redisService: RedisService,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  private userBookingsKey(userId: string, page: number, limit: number): string {
    return `${this.userBookingsPrefix}:${userId}:${page}:${limit}`;
  }

  private bookingDetailKey(bookingId: string): string {
    return `${this.bookingDetailPrefix}:${bookingId}`;
  }

  async saveUserBookingsList(
    userId: string,
    page: number,
    limit: number,
    bookings: UserBookingsListDto,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    await this.redisService.set(this.userBookingsKey(userId, page, limit), bookings, ttlSeconds);
  }

  async getUserBookingsList(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserBookingsListDto | null> {
    return this.redisService.get<UserBookingsListDto>(this.userBookingsKey(userId, page, limit));
  }

  async deleteUserBookings(userId: string): Promise<number> {
    return this.redisService.delByPrefix(`${this.userBookingsPrefix}:${userId}:`);
  }

  async saveBookingDetail(
    bookingId: string,
    booking: { status: BookingStatus } & Record<string, unknown>,
    ttlSeconds?: number,
  ): Promise<void> {
    const resolvedTtl = ttlSeconds ?? resolveBookingDetailCacheTtl(booking.status);

    if (resolvedTtl === null) {
      return;
    }

    await this.redisService.set(this.bookingDetailKey(bookingId), booking, resolvedTtl);
  }

  async getBookingDetail(bookingId: string) {
    return this.redisService.get(this.bookingDetailKey(bookingId));
  }

  async deleteBookingDetail(bookingId: string): Promise<number> {
    return this.redisService.delete(this.bookingDetailKey(bookingId));
  }

  async invalidateBooking(bookingId: string, userId: string): Promise<void> {
    await Promise.all([this.deleteBookingDetail(bookingId), this.deleteUserBookings(userId)]);
    this.bookingMetrics.recordCacheInvalidation('user_list');
    this.bookingMetrics.recordCacheInvalidation('booking_detail');
  }
}
