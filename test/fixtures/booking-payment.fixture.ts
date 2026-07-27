import {
  BookingStatus,
  Currency,
  PassengerType,
  PaymentProvider,
  Prisma,
  TransactionStatus,
  TravelClass,
} from '@prisma/client';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';

export function buildMinimalBookingSnapshot(flightInstanceId: string): BookingSnapshot {
  return {
    offer: {
      id: flightInstanceId,
      source: 'DB',
      numberOfBookableSeats: 9,
      price: {
        total: '100',
        currency: Currency.USD,
        base: '100',
        grandTotal: '100',
      },
      itineraries: [
        {
          duration: 'PT2H',
          segments: [
            {
              id: 'seg-1',
              number: '100',
              carrierCode: 'DL',
              departure: { iataCode: 'JFK', at: '2026-08-01T10:00:00' },
              arrival: { iataCode: 'SFO', at: '2026-08-01T15:00:00' },
            },
          ],
        },
      ],
    },
    pricing: {
      id: 'pricing-1',
      price: {
        base: 100,
        taxes: 0,
        fees: 0,
        taxItems: [],
        feeItems: [],
        seats: 0,
        total: 100,
        currency: 'USD',
      },
      travelers: [
        {
          travelerId: '1',
          fareOption: 'STANDARD',
          travelerType: PassengerType.ADULT,
          price: {
            currency: 'USD',
            total: '100',
            base: '100',
          },
          fareDetailsBySegment: [],
        },
      ],
      outbound: {
        from: 'JFK',
        to: 'SFO',
        departureTime: '2026-08-01T10:00:00',
        arrivalTime: '2026-08-01T15:00:00',
        durationMinutes: 300,
        stops: 0,
        segments: [],
      },
    },
    paymentProvider: PaymentProvider.STRIPE,
  };
}

export async function seedPendingPaymentBooking(prisma: PrismaService) {
  const flightInstance = await prisma.flightInstance.findFirst({
    orderBy: { departureDate: 'asc' },
  });

  if (!flightInstance) {
    throw new Error('No flight instances in database. Run: pnpm seed:demo');
  }

  const snapshot = buildMinimalBookingSnapshot(flightInstance.id);

  const user = await prisma.user.create({
    data: {
      email: `integration-${Date.now()}@test.example`,
      firstName: 'Integration',
      lastName: 'Test',
    },
  });

  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      pnrLocator: `PNR${Date.now()}`,
      flightOrderId: `order-${Date.now()}`,
      lastTicketingDate: new Date(Date.now() + 86_400_000),
      expiresAt: new Date(Date.now() + 3_600_000),
      totalPrice: new Prisma.Decimal(100),
      currency: Currency.USD,
      status: BookingStatus.PAYMENT_PENDING,
      flightInstanceId: flightInstance.id,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      travelers: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          gender: 'M',
          birthDate: new Date('1990-01-01'),
          nationality: 'US',
          passportNumber: 'P1234567',
          passportIssuanceDate: new Date('2020-01-01'),
          passportExpiry: new Date('2030-01-01'),
          passengerType: PassengerType.ADULT,
          basePrice: new Prisma.Decimal(100),
          currency: Currency.USD,
          travelClass: TravelClass.ECONOMY,
          email: user.email,
        },
      },
    },
    include: { travelers: true },
  });

  const transaction = await prisma.transaction.create({
    data: {
      idempotencyKey: `integration-${booking.id}`,
      amount: new Prisma.Decimal(100),
      currency: Currency.USD,
      userId: user.id,
      bookingId: booking.id,
      provider: PaymentProvider.STRIPE,
      status: TransactionStatus.PENDING,
    },
  });

  return { user, booking, transaction };
}
