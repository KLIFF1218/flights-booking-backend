import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateFlightInstanceFaresDto {
  @ApiProperty({ example: 15000, description: 'Adult ECONOMY price' })
  @IsNumber()
  @Min(0.01)
  economy!: number;

  @ApiProperty({ example: 24000, description: 'Adult PREMIUM_ECONOMY price' })
  @IsNumber()
  @Min(0.01)
  premiumEconomy!: number;

  @ApiProperty({ example: 42000, description: 'Adult BUSINESS price' })
  @IsNumber()
  @Min(0.01)
  business!: number;

  @ApiPropertyOptional({
    example: 67500,
    description: 'Adult FIRST price (required for airlines that sell First)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  first?: number;
}

export class CreateFlightInstanceDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0', description: 'Flight template ID (Flight)' })
  @IsString()
  flightId!: string;

  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s1', description: 'Aircraft ID' })
  @IsString()
  aircraftId!: string;

  @ApiProperty({
    example: '2026-08-15',
    description: 'Departure local date at origin airport (YYYY-MM-DD)',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'departureLocalDate must be YYYY-MM-DD',
  })
  departureLocalDate!: string;

  @ApiProperty({
    example: '10:00',
    description: 'Departure local time at origin airport (HH:mm)',
  })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'departureLocalTime must be HH:mm',
  })
  departureLocalTime!: string;

  @ApiProperty({ type: CreateFlightInstanceFaresDto, description: 'Adult prices by travel class' })
  @ValidateNested()
  @Type(() => CreateFlightInstanceFaresDto)
  fares!: CreateFlightInstanceFaresDto;

  @ApiProperty({ enum: Currency, example: Currency.RUB, description: 'Fare currency' })
  @IsEnum(Currency)
  currency!: Currency;
}
