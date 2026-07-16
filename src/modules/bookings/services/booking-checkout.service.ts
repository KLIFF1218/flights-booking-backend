import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DbPricingProvider } from 'src/modules/flights/services/DbPricingProvider.service';
import { BookingSeatService } from './booking-seat.service';
import { BookingsCacheService } from './bookings-cache.service';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import { AddSeatsDto } from '../dtos/add-seats.dto';
import { BookingPaymentService } from './booking-payment.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingProvider: DbPricingProvider,
    private readonly bookingSeatService: BookingSeatService,
    private readonly bookingsCache: BookingsCacheService,
    private readonly searchStore: FlightsSearchStore,
    private readonly bookingPaymentService: BookingPaymentService,
  ) {}
  async checkout(bookingId: string, dto: AddSeatsDto, userId: string) {
    const { seats, offerId, searchId } = dto;

    await this.findBookingForUser(bookingId, userId);

    const pricing = await this.pricingProvider.price(searchId, offerId, {
      seats,
    });

    await this.bookingSeatService.assignSeats(bookingId, userId, seats);

    await this.searchStore.deleteSeatMap(searchId, offerId);

    const booking = await this.findBookingForUser(bookingId, userId);

    await this.updateBookingPrice(bookingId, pricing.price.total);

    await this.invalidateBookingCache(bookingId, userId);

    const paymentUrl = await this.bookingPaymentService.createPayment(booking.id, userId);

    return {
      paymentRedirectUrl: paymentUrl,
    };
  }

  private async invalidateBookingCache(bookingId: string, userId: string) {
    await Promise.all([
      this.bookingsCache.deleteBookingDetail(bookingId),
      this.bookingsCache.deleteUserBookings(userId),
    ]);
  }

  private async updateBookingPrice(bookingId: string, totalPrice: number) {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        totalPrice,
      },
    });
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
