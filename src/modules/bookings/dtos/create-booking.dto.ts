import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider } from '@prisma/client';
import type { FlightOrderData } from './flight-order-booking-response.type';
import { TravelerInputDto } from './traveler.input.dto';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object)
  flightOrder: FlightOrderData;

  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TravelerInputDto)
  travelers?: TravelerInputDto[];
}
