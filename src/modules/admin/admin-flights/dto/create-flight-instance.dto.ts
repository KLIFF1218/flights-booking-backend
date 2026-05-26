import { Currency } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFlightInstanceDto {
  @IsString()
  flightId: string;

  @IsString()
  aircraftId: string;

  @IsDateString()
  departure: string;

  @IsNumber()
  price: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsOptional()
  @IsNumber()
  seatsAvailable?: number;
}
