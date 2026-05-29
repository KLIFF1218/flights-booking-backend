import { type Currency, type PaymentProvider } from '@prisma/client';

export class PassengersDto {
  adults: number;

  infants: number;

  children: number;
}

export enum TripClass {
  ECONOMY = 'Y',
  COMFORT = 'B',
  BUSSINESS = 'A',
  FIRST = 'O',
}

export class CreatePaymentDto {
  tripClass: TripClass;

  bookingId: string;
  provider: PaymentProvider;

  userId: string;

  flightId: string;

  currency: Currency;
}
