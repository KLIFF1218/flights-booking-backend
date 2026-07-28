import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  FLIGHT_PRICING_PROVIDER,
  type FlightPricingProvider,
} from 'src/modules/flights/providers/flight-pricing.provider';
import { BookingSeatService } from './booking-seat.service';
import { BookingsCacheService } from './bookings-cache.service';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import { AddSeatsDto } from '../dtos/add-seats.dto';
import { BookingPaymentService } from './booking-payment.service';
import { SeatReleaseService } from './seat-release.service';
import { BookingExpirationService } from './booking-expiration.service';
import { BookingStatus, EnumTransport, Prisma } from '@prisma/client';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import {
  assertOfferContextMatches,
  applyPricingToSnapshot,
  assertPaymentProviderSupported,
  resolvePaymentProviderFromSnapshot,
} from '../utils/booking-snapshot.util';
import { assertPaymentProviderCurrencyCompatible } from 'src/modules/payment/utils/payment-defaults.util';
import {
  assertBookingStatusAllows,
  BookingOperation,
  getAllowedStatusesForOperation,
} from '../utils/booking-status.guard';
import {
  assertBookingHasStatus,
  tryUpdateBookingIfStatus,
  updateBookingIfStatus,
} from '../utils/booking-state.util';
import {
  assertSeatSelectionComplete,
  isSeatSelectionComplete,
  resolveCheckoutSeats,
} from '../utils/booking-seat-selection.util';
import { assertTravelersReadyForCheckout } from '../utils/booking-traveler-checkout.util';
import { resolveSeatSelectionRequired } from '../utils/seatmap-availability.util';
import { SeatMapsService } from 'src/modules/seatmaps/services/seatmap.service';
import { Logger } from 'nestjs-pino';
import { FlightPricingResponse } from 'src/modules/flights/dtos';
import { BookingCheckoutResponseDto } from '../dtos/booking-checkout.response.dto';
import {
  assertPriceWithinTolerance,
  assertPricingQuoteActive,
  assertPricingQuoteIdMatches,
} from 'src/modules/flights/utils/pricing-quote.util';
import { assertBookingFlightsStillBookable } from '../utils/booking-flight-validation.util';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import {
  resolveBookingMetricReason,
  resolveCheckoutFailureStage,
} from '../metrics/booking-metrics.util';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { CHECKOUT_CLEANUP_OUTBOX_TOPIC } from '../constants/booking-outbox.constants';
import { withBookingCheckoutLock } from '../utils/booking-checkout-lock.util';
import { assertEmailVerifiedForPayment } from 'src/common/utils/assert-email-verified';

type CheckoutRollbackState = {
  seatsAssigned: boolean;
  pricingUpdated: boolean;
  paymentCreated: boolean;
  markedReadyWithoutSeats: boolean;
  previousSnapshot: BookingSnapshot;
  previousTotalPrice: number;
};

@Injectable()
export class BookingCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FLIGHT_PRICING_PROVIDER)
    private readonly pricingProvider: FlightPricingProvider,
    private readonly bookingSeatService: BookingSeatService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingPaymentService: BookingPaymentService,
    private readonly seatReleaseService: SeatReleaseService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly seatMapsService: SeatMapsService,
    private readonly outbox: OutboxService,
    private readonly logger: Logger,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}

  async checkout(
    bookingId: string,
    dto: AddSeatsDto,
    userId: string,
  ): Promise<BookingCheckoutResponseDto> {
    await assertEmailVerifiedForPayment(this.prisma, userId);

    const {
      seats,
      offerId: clientOfferId,
      searchId: clientSearchId,
      pricingQuoteId,
      paymentProvider,
    } = dto;

    const booking = await this.findBookingForUser(bookingId, userId, {
      travelers: { orderBy: { createdAt: 'asc' } },
      seatAssignments: { include: { seat: true } },
    });

    await this.bookingExpirationService.ensureActive(booking);

    if (booking.status === BookingStatus.PAYMENT_PENDING) {
      throw new ConflictException('Checkout is already in progress');
    }

    assertBookingStatusAllows(booking.status, BookingOperation.CHECKOUT);

    if (!booking.snapshot) {
      throw new BadRequestException('Booking snapshot is missing');
    }

    const snapshot = booking.snapshot as unknown as BookingSnapshot;
    if (paymentProvider) {
      assertPaymentProviderSupported(paymentProvider);
      snapshot.paymentProvider = paymentProvider;
    }
    const { searchId, offerId } = assertOfferContextMatches(
      snapshot,
      clientSearchId,
      clientOfferId,
    );

    assertTravelersReadyForCheckout(snapshot, booking.travelers);
    await assertBookingFlightsStillBookable(this.prisma, snapshot);

    const resolvedSeats = resolveCheckoutSeats(seats, booking.seatAssignments ?? []);
    const hasCompletePersistedSeats =
      seats.length === 0 && isSeatSelectionComplete(snapshot, resolvedSeats, booking.travelers);

    const seatSelectionRequired = hasCompletePersistedSeats
      ? true
      : resolvedSeats.length > 0
        ? true
        : await this.resolveSeatSelectionRequired(snapshot, searchId, offerId);

    if (seatSelectionRequired || resolvedSeats.length > 0) {
      assertSeatSelectionComplete(snapshot, resolvedSeats, booking.travelers);
    }

    let activeQuote: FlightPricingResponse | null = null;

    if (pricingQuoteId) {
      activeQuote = await this.searchStore.getLastPricing(searchId, offerId);

      assertPricingQuoteIdMatches(activeQuote, pricingQuoteId);
      assertPricingQuoteActive(activeQuote!);
    }

    const pricing = await this.pricingProvider.price(searchId, offerId, {
      seats: resolvedSeats,
      lockedFxRates: activeQuote?.fxRates,
      bookingId,
    });

    if (activeQuote) {
      assertPriceWithinTolerance(Number(activeQuote.price.total), Number(pricing.price.total));
    }

    assertPaymentProviderCurrencyCompatible(
      resolvePaymentProviderFromSnapshot(snapshot),
      pricing.price.currency,
    );

    const startedAt = Date.now();
    this.bookingMetrics.recordCheckoutStarted();

    const markReadyWithoutSeats = !seatSelectionRequired && resolvedSeats.length === 0;

    const rollbackState: CheckoutRollbackState = {
      seatsAssigned: false,
      pricingUpdated: false,
      paymentCreated: false,
      markedReadyWithoutSeats: false,
      previousSnapshot: structuredClone(snapshot),
      previousTotalPrice: Number(booking.totalPrice),
    };

    try {
      return await withBookingCheckoutLock(this.prisma, bookingId, async () => {
        await this.ensureCheckoutExclusive(bookingId, userId);

        if (seats.length > 0) {
          await this.bookingSeatService.assignSeats(bookingId, userId, seats);
          rollbackState.seatsAssigned = true;
        } else if (seatSelectionRequired && resolvedSeats.length === 0) {
          throw new BadRequestException('Seat selection is required');
        }

        await this.assertCheckoutMutable(bookingId, userId);
        await this.updateBookingPricing(bookingId, snapshot, pricing, { markReadyWithoutSeats });
        rollbackState.pricingUpdated = true;
        rollbackState.markedReadyWithoutSeats = markReadyWithoutSeats;

        await this.assertCheckoutMutable(bookingId, userId);
        const payment = await this.bookingPaymentService.createPayment(booking.id, userId, {
          afterPaymentPending: (tx) =>
            this.enqueueCheckoutCleanup(tx, bookingId, userId, searchId, offerId),
        });
        rollbackState.paymentCreated = true;

        try {
          await this.invalidateBookingCache(bookingId, userId);
        } catch (cacheError) {
          this.logger.warn(
            {
              bookingId,
              err: cacheError instanceof Error ? cacheError : String(cacheError),
            },
            'Best-effort booking cache invalidation failed after checkout',
          );
        }

        this.bookingMetrics.recordCheckoutCompleted();
        this.bookingMetrics.observeCheckoutDuration((Date.now() - startedAt) / 1000);

        return {
          paymentRedirectUrl: payment.redirectUrl,
        };
      });
    } catch (error) {
      this.bookingMetrics.recordCheckoutFailed(
        resolveCheckoutFailureStage(rollbackState),
        resolveBookingMetricReason(error),
      );
      this.bookingMetrics.recordOperationFailed('checkout', resolveBookingMetricReason(error));

      if (
        rollbackState.seatsAssigned ||
        rollbackState.pricingUpdated ||
        rollbackState.paymentCreated
      ) {
        this.logger.warn(
          {
            bookingId,
            seatsAssigned: rollbackState.seatsAssigned,
            pricingUpdated: rollbackState.pricingUpdated,
            paymentCreated: rollbackState.paymentCreated,
            err: error instanceof Error ? error : String(error),
          },
          'Checkout failed, reverting prepared state',
        );
        await this.rollbackCheckout(bookingId, userId, rollbackState);
      }

      throw error;
    }
  }

  private async rollbackCheckout(
    bookingId: string,
    userId: string,
    state: CheckoutRollbackState,
  ): Promise<void> {
    if (state.paymentCreated) {
      await this.bookingPaymentService.cancelPendingPayment(bookingId, userId);
      this.bookingMetrics.recordCheckoutRollback('payment');
    }

    if (!(await this.canRollbackCheckoutState(bookingId, userId))) {
      this.logger.warn(
        { bookingId, paymentCreated: state.paymentCreated },
        'Skipping checkout rollback because booking left checkout states',
      );
      await this.invalidateBookingCache(bookingId, userId);
      return;
    }

    if (state.pricingUpdated) {
      const restored = await this.restoreBookingPricing(
        bookingId,
        state.previousSnapshot,
        state.previousTotalPrice,
        userId,
      );

      if (restored) {
        this.bookingMetrics.recordCheckoutRollback('pricing');
      } else {
        this.logger.warn({ bookingId }, 'Skipped checkout pricing rollback');
      }
    }

    if (state.seatsAssigned) {
      await this.seatReleaseService.revertCheckoutPreparation(bookingId);
      this.bookingMetrics.recordCheckoutRollback('assign_seats');
    } else if (state.markedReadyWithoutSeats) {
      const reverted = await this.revertReadyForPaymentWithoutSeats(bookingId, userId);

      if (reverted) {
        this.bookingMetrics.recordCheckoutRollback('assign_seats');
      }
    }

    await this.invalidateBookingCache(bookingId, userId);
  }

  private async ensureCheckoutExclusive(bookingId: string, userId: string): Promise<void> {
    const current = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { status: true },
    });

    if (!current) {
      throw new NotFoundException('Booking not found');
    }

    if (current.status === BookingStatus.PAYMENT_PENDING) {
      throw new ConflictException('Checkout is already in progress');
    }

    assertBookingStatusAllows(current.status, BookingOperation.CHECKOUT);
  }

  private async assertCheckoutMutable(bookingId: string, userId: string): Promise<void> {
    await assertBookingHasStatus(
      this.prisma,
      bookingId,
      getAllowedStatusesForOperation(BookingOperation.CHECKOUT),
      userId,
    );
  }

  private async canRollbackCheckoutState(bookingId: string, userId: string): Promise<boolean> {
    const current = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { status: true },
    });

    if (!current) {
      return false;
    }

    return getAllowedStatusesForOperation(BookingOperation.CHECKOUT).includes(current.status);
  }

  private async enqueueCheckoutCleanup(
    tx: Prisma.TransactionClient,
    bookingId: string,
    userId: string,
    searchId: string,
    offerId: string,
  ): Promise<void> {
    await this.outbox.enqueue(tx, {
      aggregateId: bookingId,
      aggregateType: 'Booking',
      topic: CHECKOUT_CLEANUP_OUTBOX_TOPIC,
      key: `${bookingId}:checkout-cleanup`,
      payload: { bookingId, userId, searchId, offerId },
      transport: EnumTransport.INTERNAL,
    });

    this.bookingMetrics.recordOutboxEnqueued(CHECKOUT_CLEANUP_OUTBOX_TOPIC, EnumTransport.INTERNAL);
  }

  private async invalidateBookingCache(bookingId: string, userId: string) {
    await this.bookingsCache.invalidateBooking(bookingId, userId);
  }

  private async updateBookingPricing(
    bookingId: string,
    snapshot: BookingSnapshot,
    pricing: FlightPricingResponse,
    options?: { markReadyWithoutSeats?: boolean },
  ) {
    const updatedSnapshot = applyPricingToSnapshot(snapshot, pricing);
    const checkoutStatuses = getAllowedStatusesForOperation(BookingOperation.CHECKOUT);

    await updateBookingIfStatus(this.prisma, bookingId, checkoutStatuses, {
      totalPrice: pricing.price.total,
      currency: pricing.price.currency,
      snapshot: updatedSnapshot as unknown as Prisma.InputJsonValue,
      ...(options?.markReadyWithoutSeats ? { status: BookingStatus.SEATS_SELECTED } : {}),
    });
  }

  private async revertReadyForPaymentWithoutSeats(
    bookingId: string,
    userId: string,
  ): Promise<boolean> {
    const checkoutStatuses = getAllowedStatusesForOperation(BookingOperation.CHECKOUT);

    return tryUpdateBookingIfStatus(
      this.prisma,
      bookingId,
      checkoutStatuses,
      { status: BookingStatus.PNR_CREATED },
      userId,
    );
  }

  private async restoreBookingPricing(
    bookingId: string,
    snapshot: BookingSnapshot,
    totalPrice: number,
    userId: string,
  ): Promise<boolean> {
    const checkoutStatuses = getAllowedStatusesForOperation(BookingOperation.CHECKOUT);

    return tryUpdateBookingIfStatus(
      this.prisma,
      bookingId,
      checkoutStatuses,
      {
        totalPrice,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      userId,
    );
  }

  private async resolveSeatSelectionRequired(
    snapshot: BookingSnapshot,
    searchId: string,
    offerId: string,
  ): Promise<boolean> {
    if (snapshot.seatSelectionRequired !== undefined) {
      return snapshot.seatSelectionRequired;
    }

    let seatMap = await this.searchStore.getSeatMap(searchId, offerId);

    if (!seatMap) {
      seatMap = await this.seatMapsService.getSeatMapByOffer({ searchId, offerId });
    }

    return resolveSeatSelectionRequired(seatMap);
  }

  async findBookingForUser<TInclude extends Prisma.BookingInclude>(
    bookingId: string,
    userId: string,
    include: TInclude,
  ): Promise<Prisma.BookingGetPayload<{ include: TInclude }>>;
  async findBookingForUser(
    bookingId: string,
    userId: string,
  ): Promise<Prisma.BookingGetPayload<object>>;
  async findBookingForUser(bookingId: string, userId: string, include?: Prisma.BookingInclude) {
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
