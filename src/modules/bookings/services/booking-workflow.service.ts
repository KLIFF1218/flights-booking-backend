import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { FlightsSearchStore } from '../../flights/services/flights-cache.service';
import { CreateFlightOrderInputDto } from '../dtos/create-flight-order.input.dto';
import { BookingCreationService } from './booking-creation.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TravelerInputDto } from '../dtos/traveler.input.dto';
import { AddSeatsDto, AssignSeatDto } from '../dtos/add-seats.dto';
import { BookingsCacheService } from './bookings-cache.service';
import { Booking, EnumTransport, Prisma } from '@prisma/client';
import { BookingTravelerService } from './booking-traveler.service';
import { BookingSeatService } from './booking-seat.service';
import { BookingCheckoutService } from './booking-checkout.service';
import { BookingExpirationService } from './booking-expiration.service';
import { BookingsService } from './bookings.service';
import { mapCreateOrderTravelerToInput } from '../utils/create-order-traveler.mapper';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { resolveBookingMetricReason } from '../metrics/booking-metrics.util';
import { BookingIdempotencyService } from './booking-idempotency.service';
import { retryWithExponentialBackoff } from 'src/common/utils/retry-with-backoff.util';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { BOOKING_CREATE_COMPENSATION_OUTBOX_TOPIC } from '../constants/booking-outbox.constants';

const CREATE_COMPENSATION_MAX_ATTEMPTS = 4;

@Injectable()
export class BookingWorkflowService {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingCreationService: BookingCreationService,
    private readonly prisma: PrismaService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly bookingTravelerService: BookingTravelerService,
    private readonly bookingSeatService: BookingSeatService,
    private readonly bookingCheckoutService: BookingCheckoutService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly bookingsService: BookingsService,
    private readonly bookingIdempotency: BookingIdempotencyService,
    private readonly outbox: OutboxService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  async addTravelers(bookingId: string, userId: string, travelers: TravelerInputDto[]) {
    return this.bookingTravelerService.addTravelers(bookingId, userId, travelers);
  }

  async confirmSeatsAndStartPayment(bookingId: string, dto: AddSeatsDto, userId: string) {
    return this.bookingCheckoutService.checkout(bookingId, dto, userId);
  }

  async createBooking(dto: CreateFlightOrderInputDto, userId: string, idempotencyKey: string) {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const start = await this.bookingIdempotency.tryStart(userId, normalizedKey);

    if (start.kind === 'replay') {
      return start.response;
    }

    if (start.kind === 'in_progress') {
      throw new ConflictException('A request with this idempotency key is already in progress');
    }

    if (start.orphanedBookingId) {
      await this.compensateFailedCreate(
        start.orphanedBookingId,
        userId,
        new Error('Idempotency reclaim of incomplete booking create'),
      );
    }

    let createdBookingId: string | undefined;

    try {
      const result = await this.executeCreateBooking(dto, userId);
      createdBookingId =
        result && typeof result === 'object' && 'id' in result && typeof result.id === 'string'
          ? result.id
          : undefined;

      if (createdBookingId) {
        await this.bookingIdempotency.attachBooking(start.record.id, createdBookingId);
      }

      await this.bookingIdempotency.complete(start.record.id, result, createdBookingId);
      return result;
    } catch (error) {
      await this.bookingIdempotency.fail(start.record.id);

      if (createdBookingId) {
        await this.compensateFailedCreate(createdBookingId, userId, error);
      }

      throw error;
    }
  }

  private async executeCreateBooking(dto: CreateFlightOrderInputDto, userId: string) {
    const { searchId, offerId, travelers, seats, paymentProvider } = dto;

    const flightOffer = await this.searchStore.getOffer(searchId, offerId);

    if (!flightOffer) {
      throw new NotFoundException('Offer not found');
    }

    const booking = await this.bookingCreationService.createBooking(
      userId,
      flightOffer,
      searchId,
      offerId,
      paymentProvider,
    );

    try {
      if (travelers?.length) {
        const persistableTravelers = travelers.map(mapCreateOrderTravelerToInput);
        await this.bookingTravelerService.addTravelers(booking.id, userId, persistableTravelers);
      }

      if (seats?.length) {
        await this.bookingSeatService.assignSeats(booking.id, userId, seats);
      }
    } catch (error) {
      await this.compensateFailedCreate(booking.id, userId, error);
      throw error;
    }

    if (travelers?.length || seats?.length) {
      return this.findBookingForUser(booking.id, userId, {
        travelers: { orderBy: { createdAt: 'asc' } },
      });
    }

    return booking;
  }

  private async compensateFailedCreate(
    bookingId: string,
    userId: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await retryWithExponentialBackoff(
        () => this.bookingsService.compensateFailedCreateBooking(bookingId, userId),
        {
          maxAttempts: CREATE_COMPENSATION_MAX_ATTEMPTS,
        },
      );
    } catch (compensationError) {
      this.bookingMetrics.recordCreateCompensationFailed();
      this.bookingMetrics.recordOperationFailed(
        'create',
        resolveBookingMetricReason(compensationError),
      );
      this.logger.error(
        {
          bookingId,
          err: compensationError instanceof Error ? compensationError : String(compensationError),
          originalErr: originalError instanceof Error ? originalError : String(originalError),
        },
        'DEAD LETTER: failed to compensate booking after create workflow error',
      );
      await this.enqueueCreateCompensationRetry(bookingId, userId, compensationError);
    }
  }

  private async enqueueCreateCompensationRetry(
    bookingId: string,
    userId: string,
    error: unknown,
  ): Promise<void> {
    try {
      await this.outbox.enqueue(this.prisma, {
        aggregateId: bookingId,
        aggregateType: 'Booking',
        topic: BOOKING_CREATE_COMPENSATION_OUTBOX_TOPIC,
        key: `${bookingId}:create-compensation`,
        payload: {
          bookingId,
          userId,
        },
        transport: EnumTransport.INTERNAL,
      });
      this.bookingMetrics.recordOutboxEnqueued(
        BOOKING_CREATE_COMPENSATION_OUTBOX_TOPIC,
        EnumTransport.INTERNAL,
      );
    } catch (enqueueError) {
      this.logger.error(
        {
          bookingId,
          userId,
          err: enqueueError instanceof Error ? enqueueError : String(enqueueError),
          originalErr: error instanceof Error ? error : String(error),
        },
        'Failed to enqueue create compensation retry',
      );
      throw enqueueError;
    }
  }

  async assignSeats(bookingId: string, userId: string, seats: AssignSeatDto[]) {
    return this.bookingSeatService.assignSeats(bookingId, userId, seats);
  }

  async getById(id: string, userId: string) {
    const cachedBooking = await this.bookingsCache.getBookingDetail(id);
    if (cachedBooking) {
      this.bookingMetrics.recordCacheHit('booking_detail');
      const booking = cachedBooking as Booking;
      if (booking.userId !== userId) {
        throw new NotFoundException('Booking not found');
      }

      if (await this.bookingExpirationService.expireIfNeeded(booking)) {
        return this.findBookingForUser(id, userId, {
          travelers: { orderBy: { createdAt: 'asc' } },
          transaction: true,
        });
      }

      return cachedBooking;
    }

    this.bookingMetrics.recordCacheMiss('booking_detail');

    const booking = await this.findBookingForUser(id, userId, {
      travelers: { orderBy: { createdAt: 'asc' } },
      transaction: true,
    });

    const expired = await this.bookingExpirationService.expireIfNeeded(booking);

    const result = expired
      ? await this.findBookingForUser(id, userId, {
          travelers: { orderBy: { createdAt: 'asc' } },
          transaction: true,
        })
      : booking;

    await this.bookingsCache.saveBookingDetail(id, result);

    return result;
  }

  async findBookingForUser<TInclude extends Prisma.BookingInclude | undefined>(
    bookingId: string,
    userId: string,
    include?: TInclude,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }
}
