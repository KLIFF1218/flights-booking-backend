import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import {
  BookingProvider,
  BookingStatus,
  EnumTransport,
  PaymentProvider,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { addMinutes } from 'date-fns';
import { BOOKING_EXPIRATION_MINUTES } from '../constants/booking-expiration.constants';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import {
  FLIGHT_PRICING_PROVIDER,
  type FlightPricingProvider,
} from 'src/modules/flights/providers/flight-pricing.provider';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';
import {
  extractFlightInstanceIds,
  resolvePrimaryFlightInstanceId,
} from 'src/modules/flights/utils/offer-flight-instances.util';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { resolveBookingMetricReason } from '../metrics/booking-metrics.util';
import {
  assertPaymentProviderSupported,
  resolvePaymentProvider,
} from '../utils/booking-snapshot.util';
import { assertPaymentProviderCurrencyCompatible } from 'src/modules/payment/utils/payment-defaults.util';
import {
  assertPriceWithinTolerance,
  assertPricingQuoteActive,
} from 'src/modules/flights/utils/pricing-quote.util';
import {
  assertFlightInstancesBookable,
  syncOfferScheduleFromPricing,
} from 'src/modules/flights/utils/offer-schedule.util';
import {
  reserveFlightInstanceInventory,
  resolveSeatsToReserve,
} from '../utils/booking-inventory.util';
import { SeatMapsService } from 'src/modules/seatmaps/services/seatmap.service';
import { isSeatSelectionRequired } from '../utils/seatmap-availability.util';
import { OutboxService } from 'src/infra/outbox/outbox.service';

@Injectable()
export class BookingCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly searchStore: FlightsSearchStore,
    @Inject(FLIGHT_PRICING_PROVIDER)
    private readonly pricingProvider: FlightPricingProvider,
    private readonly metrics: MetricsService,
    private readonly bookingMetrics: BookingMetricsService,
    private readonly seatMapsService: SeatMapsService,
    private readonly outbox: OutboxService,
  ) {}

  private generatePnr(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(6);

    let pnr = '';

    for (let i = 0; i < 6; i++) {
      pnr += chars[bytes[i] % chars.length];
    }

    return pnr;
  }

  private async generateUniquePnr(tx: Prisma.TransactionClient): Promise<string> {
    let pnr = this.generatePnr();

    while (
      await tx.booking.findUnique({
        where: { pnrLocator: pnr },
      })
    ) {
      pnr = this.generatePnr();
    }

    return pnr;
  }

  async createBooking(
    userId: string,
    flightOffer: FlightOffer,
    searchId: string,
    offerId: string,
    paymentProvider?: PaymentProvider,
  ) {
    const resolvedPaymentProvider = resolvePaymentProvider(paymentProvider);
    assertPaymentProviderSupported(resolvedPaymentProvider);

    this.logger.debug({ userId, searchId, offerId }, 'Creating booking');
    const originalOffer = await this.searchStore.getOffer(searchId, offerId);

    if (!originalOffer) {
      throw new NotFoundException('Offer not found');
    }

    const flightInstanceIds = extractFlightInstanceIds(originalOffer);
    const primaryFlightInstanceId = resolvePrimaryFlightInstanceId(originalOffer);

    const flightInstances = await this.prisma.flightInstance.findMany({
      where: { id: { in: flightInstanceIds } },
      include: {
        fares: true,
        seats: true,
        flight: {
          include: {
            airline: true,
          },
        },
      },
    });

    if (flightInstances.length !== flightInstanceIds.length) {
      const foundIds = new Set(flightInstances.map((instance) => instance.id));
      const missingIds = flightInstanceIds.filter((id) => !foundIds.has(id));

      throw new NotFoundException(`Flight instance not found: ${missingIds.join(', ')}`);
    }

    assertFlightInstancesBookable(flightInstances);

    const primaryFlightInstance = flightInstances.find(
      (instance) => instance.id === primaryFlightInstanceId,
    );

    if (!primaryFlightInstance) {
      throw new NotFoundException('Flight instance not found');
    }

    const quotedPricing = await this.searchStore.getLastPricing(searchId, offerId);

    if (quotedPricing) {
      assertPricingQuoteActive(quotedPricing);
    }

    const latestPricing = await this.pricingProvider.price(searchId, offerId, {
      lockedFxRates: quotedPricing?.fxRates,
    });

    if (quotedPricing) {
      assertPriceWithinTolerance(
        Number(quotedPricing.price.total),
        Number(latestPricing.price.total),
      );
    }

    const actualPrice = Number(latestPricing.price.total);
    assertPaymentProviderCurrencyCompatible(resolvedPaymentProvider, latestPricing.price.currency);

    const expiresAt = addMinutes(new Date(), BOOKING_EXPIRATION_MINUTES);
    const airlineCode = primaryFlightInstance.flight.airline.code;

    const seatMap = await this.seatMapsService.getSeatMapByOffer({ searchId, offerId });

    const snapshot: BookingSnapshot = {
      offer: syncOfferScheduleFromPricing(originalOffer, latestPricing),
      pricing: latestPricing,
      searchId,
      offerId,
      paymentProvider: resolvedPaymentProvider,
      seatSelectionRequired: isSeatSelectionRequired(seatMap),
    };

    const startedAt = Date.now();

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const seatsToReserve = resolveSeatsToReserve(snapshot);
        try {
          await reserveFlightInstanceInventory(tx, flightInstanceIds, seatsToReserve);
          this.bookingMetrics.recordInventoryReserved();
        } catch (inventoryError) {
          this.bookingMetrics.recordInventoryReservationFailed(
            resolveBookingMetricReason(inventoryError),
          );
          throw inventoryError;
        }

        const pnr = await this.generateUniquePnr(tx);
        const createdBooking = await tx.booking.create({
          data: {
            userId,

            provider: BookingProvider.INTERNAL,
            status: BookingStatus.PNR_CREATED,
            pnrLocator: pnr,
            flightOrderId: `${Date.now()}`,

            expiresAt,
            lastTicketingDate: expiresAt,

            totalPrice: actualPrice,
            currency: latestPricing.price.currency,

            snapshot: snapshot as unknown as Prisma.InputJsonValue,

            flightInstanceId: primaryFlightInstanceId,
          },
        });

        this.logger.debug(
          {
            bookingId: createdBooking.id,
            pnr,
            flightInstanceId: primaryFlightInstanceId,
            flightInstanceIds,
          },
          'Booking created',
        );

        const occurredAt = new Date().toISOString();

        await this.outbox.enqueue(tx, {
          aggregateId: createdBooking.id,
          aggregateType: 'Booking',
          topic: 'booking.created',
          key: createdBooking.id,
          payload: {
            bookingId: createdBooking.id,
            userId,
            pnr,
            status: BookingStatus.PNR_CREATED,
            totalPrice: actualPrice,
            currency: flightOffer.price.currency,
            occurredAt,
          },
          transport: EnumTransport.KAFKA,
        });

        return createdBooking;
      });

      this.bookingMetrics.recordBookingCreated(
        resolvedPaymentProvider,
        BookingStatus.PNR_CREATED,
        airlineCode,
      );
      this.bookingMetrics.observeBookingCreationDuration(
        (Date.now() - startedAt) / 1000,
        resolvedPaymentProvider,
        airlineCode,
      );
      this.metrics.recordBookingValue(
        Math.round(actualPrice * 100),
        flightOffer.price.currency,
        airlineCode,
      );

      return booking;
    } catch (error) {
      const reason = resolveBookingMetricReason(error);
      this.bookingMetrics.recordOperationFailed('create', reason);
      throw error;
    }
  }
}
