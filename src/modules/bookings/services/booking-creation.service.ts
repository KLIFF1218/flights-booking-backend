import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { BookingProvider, BookingStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { addMinutes } from 'date-fns';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import { DbPricingProvider } from 'src/modules/flights/services/DbPricingProvider.service';
import { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import { FlightOffer } from 'src/modules/flights/interfaces/flight-offers.interface';

@Injectable()
export class BookingCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly searchStore: FlightsSearchStore,
    private readonly pricingProvider: DbPricingProvider,
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
    travelers?: any[],
    searchId?: string,
    offerId?: string,
  ) {
    console.log('travelers is :', travelers);
    console.log('start to book in booking-creating.service.ts');
    const originalOffer = await this.searchStore.getOffer(searchId!, offerId!);

    if (!originalOffer) {
      throw new NotFoundException('Offer not found');
    }

    const flightInstanceId = flightOffer.id;

    const flightInstance = await this.prisma.flightInstance.findUnique({
      where: { id: flightInstanceId },
      include: { fares: true, seats: true },
    });

    if (!flightInstance) {
      throw new NotFoundException('Flight instance not found');
    }

    const latestPricing = await this.pricingProvider.price(searchId!, offerId!);

    const clientPrice = Number(flightOffer.price.grandTotal ?? flightOffer.price.total);

    const actualPrice = Number(latestPricing.price.total);

    if (Math.abs(clientPrice - actualPrice) > 0.01) {
      this.logger.warn({
        clientPrice,
        actualPrice,
      });

      throw new BadRequestException('Price has changed');
    }

    const expiresAt = addMinutes(new Date(), 30);

    const snapshot: BookingSnapshot = {
      offer: originalOffer,
      pricing: latestPricing,
    };

    return this.prisma.$transaction(async (tx) => {
      const pnr = await this.generateUniquePnr(tx);
      const booking = await tx.booking.create({
        data: {
          userId,

          provider: BookingProvider.MOCK,
          status: BookingStatus.PNR_CREATED,
          pnrLocator: pnr,
          flightOrderId: `${Date.now()}`,

          expiresAt,
          lastTicketingDate: expiresAt,

          totalPrice: actualPrice,
          currency: flightOffer.price.currency,

          snapshot: snapshot as unknown as Prisma.InputJsonValue,

          flightInstanceId,
        },
      });

      // const travelerPricings = latestPricing.travelers;
      // if (travelers && travelers.length > 0) {
      //   await tx.traveler.createMany({
      //     data: travelers.map((t, index) => {
      //       const travelerPricing = travelerPricings[index];

      //       if (!travelerPricing) {
      //         throw new BadRequestException(`Pricing for traveler ${index + 1} not found`);
      //       }

      //       console.log('t this is a: ', t);

      //       const document = t.documents?.[0];
      //       const phone = t.contact?.phones?.[0];

      //       const fareDetails = travelerPricing.fareDetailsBySegment?.[0];

      //       if (!document) {
      //         throw new BadRequestException(
      //           `Traveler document missing for ${t.name?.firstName ?? 'unknown'}`,
      //         );
      //       }

      //       return {
      //         bookingId: booking.id,

      //         firstName: t.name.firstName,
      //         lastName: t.name.lastName,
      //         gender: t.gender,

      //         birthDate: new Date(t.dateOfBirth),

      //         nationality: document.nationality,
      //         birthPlace: document.birthPlace,

      //         passportNumber: document.number,
      //         passportIssuanceDate: new Date(document.issuanceDate),
      //         passportExpiry: new Date(document.expiryDate),

      //         email: t.contact?.emailAddress ?? null,
      //         phoneCountryCode: phone?.countryCallingCode ?? null,
      //         phoneNumber: phone?.number ?? null,

      //         passengerType: travelerPricing.travelerType as PassengerType,

      //         basePrice: Number(travelerPricing.price.base),

      //         currency: travelerPricing.price.currency,
      //         travelClass: fareDetails?.cabin ?? 'ECONOMY',

      //         fareBasis: fareDetails?.fareBasis ?? null,

      //         checkedBags: fareDetails?.includedCheckedBags?.quantity ?? 0,
      //       };
      //     }),
      //   });

      //   const created = await tx.traveler.findMany({
      //     where: {
      //       bookingId: booking.id,
      //     },
      //   });

      //   console.dir(created, { depth: null });
      // }

      this.logger.debug(
        {
          bookingId: booking.id,
          pnr,
          flightInstanceId,
        },
        'Booking created',
      );

      return booking;
    });
  }
}
