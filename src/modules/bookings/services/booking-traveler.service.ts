import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { BookingsCacheService } from './bookings-cache.service';
import { PassengerType, Prisma } from '@prisma/client';
import { TravelerInputDto } from '../dtos/traveler.input.dto';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import { Logger } from 'nestjs-pino';
import { isInfantType } from 'src/modules/flights/utils/passenger-counts.util';
import {
  extractDepartureDateFromSnapshot,
  extractIsInternationalFromSnapshot,
  validateTravelersForBooking,
} from '../utils/traveler-age-validation.util';
import { normalizeTravelerInput } from '../utils/traveler-normalization.util';
import {
  assertBookingStatusAllows,
  BookingOperation,
  getAllowedStatusesForOperation,
} from '../utils/booking-status.guard';
import { assertBookingHasStatus } from '../utils/booking-state.util';
import { BookingExpirationService } from './booking-expiration.service';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { resolveBookingMetricReason } from '../metrics/booking-metrics.util';

@Injectable()
export class BookingTravelerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly logger: Logger,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly bookingMetrics: BookingMetricsService,
  ) {}
  async addTravelers(bookingId: string, userId: string, travelers: TravelerInputDto[]) {
    try {
      return await this.addTravelersInternal(bookingId, userId, travelers);
    } catch (error) {
      const reason = resolveBookingMetricReason(error);
      this.bookingMetrics.recordTravelerValidationFailed(reason);
      this.bookingMetrics.recordOperationFailed('add_travelers', reason);
      throw error;
    }
  }

  private async addTravelersInternal(
    bookingId: string,
    userId: string,
    travelers: TravelerInputDto[],
  ) {
    const booking = await this.findBookingForUser(bookingId, userId);

    await this.bookingExpirationService.ensureActive(booking);

    assertBookingStatusAllows(booking.status, BookingOperation.ADD_TRAVELERS);

    const snapshot = booking.snapshot as unknown as BookingSnapshot;

    const travelerPricings = snapshot.pricing.travelers;

    const parseDate = (value: string) => {
      const date = new Date(value);

      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid date: ${value}`);
      }

      return date;
    };

    this.logger.debug(
      { bookingId, travelerCount: travelers.length },
      'Adding travelers to booking',
    );

    if (travelerPricings?.length && travelers.length !== travelerPricings.length) {
      throw new BadRequestException(
        `Expected ${travelerPricings.length} travelers, received ${travelers.length}`,
      );
    }

    const passengerTypes = travelerPricings?.map((pricing) => pricing.travelerType) ?? [];
    const departureDate = extractDepartureDateFromSnapshot(snapshot);
    const isInternational = extractIsInternationalFromSnapshot(snapshot);
    const normalizedTravelers = travelers.map((traveler, index) =>
      normalizeTravelerInput(
        traveler,
        passengerTypes[index] ?? PassengerType.ADULT,
        isInternational,
        departureDate,
      ),
    );

    validateTravelersForBooking(
      normalizedTravelers,
      passengerTypes,
      departureDate,
      isInternational,
    );

    const clientIds = normalizedTravelers
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id));

    const idsTakenByOtherBookings = clientIds.length
      ? await this.prisma.traveler.findMany({
          where: {
            id: { in: clientIds },
            bookingId: { not: bookingId },
          },
          select: { id: true },
        })
      : [];

    const blockedIds = new Set(idsTakenByOtherBookings.map((t) => t.id));

    const updated = await this.prisma.$transaction(async (tx) => {
      await assertBookingHasStatus(
        tx,
        bookingId,
        getAllowedStatusesForOperation(BookingOperation.ADD_TRAVELERS),
        userId,
      );

      const [assignmentsCount, holdsCount] = await Promise.all([
        tx.seatAssignment.count({ where: { bookingId } }),
        tx.seatHold.count({ where: { bookingId } }),
      ]);

      if (assignmentsCount > 0 || holdsCount > 0) {
        throw new BadRequestException(
          'Cannot modify travelers while seats are assigned. Release seats first.',
        );
      }

      await tx.traveler.deleteMany({ where: { bookingId } });

      const travelerRows = normalizedTravelers.map((t, index) => {
        const travelerPricing = travelerPricings?.[index];
        const canUseClientId = Boolean(t.id && !blockedIds.has(t.id));

        return {
          ...(canUseClientId ? { id: t.id } : {}),
          bookingId,
          firstName: t.firstName,
          lastName: t.lastName,
          gender: t.gender,
          passengerType: travelerPricing?.travelerType ?? PassengerType.ADULT,
          currency: travelerPricing?.price?.currency ?? booking.currency,
          travelClass: travelerPricing?.fareDetailsBySegment?.[0]?.cabin ?? 'ECONOMY',
          basePrice: travelerPricing?.price?.base ? Number(travelerPricing.price.base) : 0,
          fareBasis: travelerPricing?.fareDetailsBySegment?.[0]?.fareBasis ?? null,
          checkedBags:
            travelerPricing?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity ?? 0,
          birthDate: parseDate(t.dateOfBirth),
          nationality: t.nationality,
          birthPlace: t.birthPlace ?? null,
          passportNumber: t.passportNumber,
          passportIssuanceDate: parseDate(t.passportIssuanceDate),
          passportExpiry: parseDate(t.passportExpiry),
          email: t.email || null,
          phoneCountryCode: t.phoneCountryCode || null,
          phoneNumber: t.phoneNumber || null,
        };
      });

      await tx.traveler.createMany({ data: travelerRows });

      for (const [index, traveler] of normalizedTravelers.entries()) {
        const passengerType = passengerTypes[index] ?? PassengerType.ADULT;
        if (!isInfantType(passengerType) || !traveler.accompanyingTravelerId) {
          continue;
        }

        const travelerId = traveler.id && !blockedIds.has(traveler.id) ? traveler.id : undefined;
        if (!travelerId) {
          continue;
        }

        await tx.traveler.update({
          where: { id: travelerId },
          data: { accompanyingTravelerId: traveler.accompanyingTravelerId },
        });
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { travelers: true },
      });
    });

    await this.bookingsCache.invalidateBooking(bookingId, booking.userId);
    this.bookingMetrics.recordTravelersAdded();

    return updated;
  }

  private async findBookingForUser<TInclude extends Prisma.BookingInclude | undefined>(
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
