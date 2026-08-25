import { Injectable } from '@nestjs/common';
import { BookingIdempotencyRecord, IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

const BOOKING_IDEMPOTENCY_STALE_PROCESSING_MS = 5 * 60_000;

export type BookingIdempotencyStartResult =
  | { kind: 'new'; record: BookingIdempotencyRecord; orphanedBookingId?: string | null }
  | { kind: 'replay'; response: unknown }
  | { kind: 'in_progress' };

@Injectable()
export class BookingIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async tryStart(userId: string, key: string): Promise<BookingIdempotencyStartResult> {
    try {
      const record = await this.prisma.bookingIdempotencyRecord.create({
        data: {
          userId,
          key,
          status: IdempotencyStatus.PROCESSING,
        },
      });

      return { kind: 'new', record };
    } catch (error) {
      const existing = await this.prisma.bookingIdempotencyRecord.findUnique({
        where: {
          userId_key: {
            userId,
            key,
          },
        },
      });

      if (!existing) {
        throw error;
      }

      if (existing.status === IdempotencyStatus.COMPLETED && existing.response !== null) {
        return { kind: 'replay', response: existing.response };
      }

      if (existing.status === IdempotencyStatus.FAILED) {
        const orphanedBookingId = existing.bookingId;
        const record = await this.tryReclaimFailed(existing.id);
        return record ? { kind: 'new', record, orphanedBookingId } : { kind: 'in_progress' };
      }

      if (
        existing.status === IdempotencyStatus.PROCESSING &&
        this.isStaleProcessing(existing.updatedAt)
      ) {
        const orphanedBookingId = existing.bookingId;
        const record = await this.tryReclaimStale(existing.id);
        return record ? { kind: 'new', record, orphanedBookingId } : { kind: 'in_progress' };
      }

      return { kind: 'in_progress' };
    }
  }

  async attachBooking(id: string, bookingId: string): Promise<void> {
    await this.prisma.bookingIdempotencyRecord.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
      },
      data: { bookingId },
    });
  }

  async complete(id: string, response: unknown, bookingId?: string): Promise<void> {
    await this.prisma.bookingIdempotencyRecord.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
      },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: response as Prisma.InputJsonValue,
        bookingId,
      },
    });
  }

  async fail(id: string): Promise<void> {
    await this.prisma.bookingIdempotencyRecord.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
      },
      data: {
        status: IdempotencyStatus.FAILED,
      },
    });
  }

  private async tryReclaimFailed(id: string): Promise<BookingIdempotencyRecord | null> {
    const reclaimed = await this.prisma.bookingIdempotencyRecord.updateMany({
      where: {
        id,
        status: IdempotencyStatus.FAILED,
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });

    if (reclaimed.count !== 1) {
      return null;
    }

    return this.prisma.bookingIdempotencyRecord.findUnique({ where: { id } });
  }

  private async tryReclaimStale(id: string): Promise<BookingIdempotencyRecord | null> {
    const staleBefore = new Date(Date.now() - BOOKING_IDEMPOTENCY_STALE_PROCESSING_MS);

    const reclaimed = await this.prisma.bookingIdempotencyRecord.updateMany({
      where: {
        id,
        status: IdempotencyStatus.PROCESSING,
        updatedAt: {
          lte: staleBefore,
        },
      },
      data: {
        status: IdempotencyStatus.PROCESSING,
      },
    });

    if (reclaimed.count !== 1) {
      return null;
    }

    return this.prisma.bookingIdempotencyRecord.findUnique({ where: { id } });
  }

  private isStaleProcessing(updatedAt: Date): boolean {
    return updatedAt.getTime() <= Date.now() - BOOKING_IDEMPOTENCY_STALE_PROCESSING_MS;
  }
}
