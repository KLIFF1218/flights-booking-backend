import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { FlightsSearchStore } from '../../flights/services/flights-cache.service';
import { BookingsService } from './bookings.service';
import { CreateFlightOrderInputDto } from '../dtos/create-flight-order.input.dto';
import { MockBookingService } from './mock-booking.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { TravelerInputDto } from '../dtos/traveler.input.dto';
import { AddSeatsDto, AssignSeatDto } from '../dtos/add-seats.dto';
import { DbPricingProvider } from 'src/modules/flights/services/DbPricingProvider.service';
import { BookingsCacheService } from './bookings-cache.service';
import { Booking, BookingStatus, PassengerType, Prisma } from '@prisma/client';

@Injectable()
export class FlightBookingService {
  constructor(
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingService: BookingsService,
    private readonly logger: Logger,
    private readonly mockBookingService: MockBookingService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pricingProvider: DbPricingProvider,
    private readonly bookingsCache: BookingsCacheService,
  ) {}

  async bookingFlight(dto: CreateFlightOrderInputDto, userId: string) {
    const { searchId, offerId, travelers, paymentProvider } = dto;

    const offer = await this.searchStore.getLastPricing(searchId, offerId);

    if (!offer) {
      throw new NotFoundException('Offer not found in cache');
    }

    const flightOffer = offer;
    const booking = await this.mockBookingService.createMockBooking(
      userId,
      flightOffer,
      travelers,
      searchId,
      offerId,
    );

    return booking;
  }

  async addTravelers(bookingId: string, userId: string, travelers: TravelerInputDto[]) {
    const booking = await this.findBookingForUser(bookingId, userId);

    const snapshot = booking.snapshot as any;

    const travelerPricings =
      snapshot.flightOffers?.[0]?.travelerPricings ?? snapshot.travelerPricings;

    const parseDate = (value: string) => {
      const date = new Date(value);

      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid date: ${value}`);
      }

      return date;
    };

    console.log('travelers: ', travelers);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        travelers: {
          deleteMany: { bookingId },
          create: travelers.map((t, index) => {
            const travelerPricing = travelerPricings?.[index];

            return {
              firstName: t.firstName,
              lastName: t.lastName,
              gender: t.gender,

              passengerType:
                (travelerPricing?.travelerType as PassengerType) ?? PassengerType.ADULT,

              currency: travelerPricing?.price?.currency ?? booking.currency,

              travelClass: travelerPricing?.fareDetailsBySegment?.[0]?.cabin ?? 'ECONOMY',

              basePrice: travelerPricing?.price?.base ? Number(travelerPricing.price.base) : 0,

              fareBasis: travelerPricing?.fareDetailsBySegment?.[0]?.fareBasis ?? null,

              checkedBags:
                travelerPricing?.fareDetailsBySegment?.[0]?.includedCheckedBags?.quantity ?? 0,

              birthDate: parseDate(t.dateOfBirth),

              nationality: t.nationality,
              birthPlace: t.birthPlace,

              passportNumber: t.passportNumber,
              passportIssuanceDate: parseDate(t.passportIssuanceDate),
              passportExpiry: parseDate(t.passportExpiry),

              email: t.email,
              phoneCountryCode: t.phoneCountryCode,
              phoneNumber: t.phoneNumber,
            };
          }),
        },
      },
      include: {
        travelers: true,
      },
    });

    console.dir(updated, { depth: null });

    await this.bookingsCache.deleteUserBookings(booking.userId);
    await this.bookingsCache.deleteBookingDetail(bookingId);

    return updated;
  }

  async assignSeats(bookingId: string, userId: string, seats: AssignSeatDto[]) {
    const booking = await this.findBookingForUser(bookingId, userId, {
      travelers: true,
      flightInstance: {
        include: {
          flight: {
            include: {
              segments: true,
            },
          },
        },
      },
    });

    const travelerIds = booking.travelers.map((t) => t.id);

    if (!booking.flightInstance) {
      throw new NotFoundException('Flight instance not found in booking');
    }

    const segmentIds = booking.flightInstance.flight.segments.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      for (const seatRequest of seats) {
        if (!travelerIds.includes(seatRequest.travelerId)) {
          throw new BadRequestException('Traveler not in booking');
        }

        if (!segmentIds.includes(seatRequest.segmentId)) {
          throw new BadRequestException('Invalid segment');
        }

        const seat = await tx.flightSeat.findFirst({
          where: {
            flightInstanceId: booking.flightInstanceId!,
            seatNumber: seatRequest.seatNumber,
            status: 'AVAILABLE',
          },
        });

        if (!seat) {
          throw new BadRequestException(`Seat ${seatRequest.seatNumber} not found`);
        }

        try {
          await tx.seatHold.create({
            data: {
              bookingId,
              flightSeatId: seat.id,
              segmentId: seatRequest.segmentId,
              travelerId: seatRequest.travelerId,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            throw new BadRequestException('Seat already reserved');
          }

          throw e;
        }

        await tx.seatAssignment.upsert({
          where: {
            travelerId_segmentId: {
              travelerId: seatRequest.travelerId,
              segmentId: seatRequest.segmentId,
            },
          },
          update: {
            flightSeatId: seat.id,
          },
          create: {
            travelerId: seatRequest.travelerId,
            flightSeatId: seat.id,
            segmentId: seatRequest.segmentId,
            bookingId,
          },
        });

        await tx.flightSeat.update({
          where: {
            id: seat.id,
          },
          data: {
            status: 'RESERVED',
          },
        });

        await tx.booking.update({
          where: {
            id: bookingId,
          },
          data: {
            status: BookingStatus.SEATS_SELECTED,
          },
        });
      }
    });

    return {
      success: true,
    };
  }
  async confirmSeatsAndStartPayment(bookingId: string, dto: AddSeatsDto, userId: string) {
    const { seats, offerId, searchId } = dto;

    await this.findBookingForUser(bookingId, userId);

    const pricing = await this.pricingProvider.price(searchId, offerId, {
      seats,
    });

    await this.assignSeats(bookingId, userId, seats);

    await this.searchStore.deleteSeatMap(searchId, offerId);

    const booking = await this.findBookingForUser(bookingId, userId);

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        totalPrice: pricing.price.total,
      },
    });

    await this.bookingsCache.deleteUserBookings(userId);
    await this.bookingsCache.deleteBookingDetail(bookingId);

    const paymentUrl = await this.bookingService.createPaymentForBooking(booking.id, userId);

    return {
      paymentRedirectUrl: paymentUrl,
    };
  }

  async getById(id: string, userId: string) {
    const cachedBooking = await this.bookingsCache.getBookingDetail(id);
    if (cachedBooking) {
      const booking = cachedBooking as Booking;
      if (booking.userId !== userId) {
        throw new NotFoundException('Booking not found');
      }

      return cachedBooking;
    }

    const booking = await this.findBookingForUser(id, userId);

    await this.bookingsCache.saveBookingDetail(id, booking);

    return booking;
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
