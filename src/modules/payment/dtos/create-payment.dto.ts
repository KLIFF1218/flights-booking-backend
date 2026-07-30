import { ApiProperty } from '@nestjs/swagger';
import { type Currency, PaymentProvider } from '@prisma/client';
import { OPENAPI_PAYMENT_PROVIDERS } from 'src/common/swagger/openapi-enums';

export class PassengersDto {
  @ApiProperty({ example: 1, minimum: 1 })
  adults!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  infants!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  children!: number;
}

export enum TripClass {
  ECONOMY = 'Y',
  COMFORT = 'B',
  BUSSINESS = 'A',
  FIRST = 'O',
}

/** Legacy / internal payment shape — not currently bound to an HTTP controller. */
export class CreatePaymentDto {
  @ApiProperty({ enum: TripClass, example: TripClass.ECONOMY })
  tripClass!: TripClass;

  @ApiProperty({ example: 'clbooking0123456789' })
  bookingId!: string;

  @ApiProperty({
    example: 'STRIPE',
    enum: OPENAPI_PAYMENT_PROVIDERS,
    enumName: 'PaymentProvider',
  })
  provider!: PaymentProvider;

  @ApiProperty({ example: 'cluser0123456789' })
  userId!: string;

  @ApiProperty({ example: 'clflight0123456789' })
  flightId!: string;

  @ApiProperty({ example: 'RUB' })
  currency!: Currency;
}
