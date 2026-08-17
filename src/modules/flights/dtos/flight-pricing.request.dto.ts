import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FareBrand } from '@prisma/client';
import { CurrencyCode } from './search-flight.request.dto';

export class SeatOptionDto {
  @IsString()
  @ApiProperty({ example: 'trav_1' })
  travelerId!: string;

  @IsString()
  @ApiProperty({ example: 'seg_1' })
  segmentId!: string;

  @IsString()
  @ApiProperty({ example: '12A' })
  seatNumber!: string;
}

export class FlightPricingOptionsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatOptionDto)
  @ApiPropertyOptional({ type: [SeatOptionDto] })
  seats?: SeatOptionDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 1 })
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 0 })
  children?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 0 })
  infants?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 0 })
  seatedInfants?: number;

  @IsOptional()
  @IsEnum(CurrencyCode)
  @ApiPropertyOptional({ example: CurrencyCode.EUR, enum: CurrencyCode })
  currencyCode?: CurrencyCode;

  @IsOptional()
  @IsEnum(FareBrand)
  @ApiPropertyOptional({
    enum: FareBrand,
    example: FareBrand.FLEX,
    description: 'Fare family for repricing (LIGHT default, FLEX upsell)',
  })
  fareBrand?: FareBrand;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'Active booking id — restores offer from snapshot when search cache expired',
  })
  bookingId?: string;
}

export class FlightPricingRequestDto {
  @IsString()
  @ApiProperty({ example: 'search_abc123' })
  searchId!: string;

  @IsString()
  @ApiProperty({ example: 'offer_1' })
  offerId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlightPricingOptionsDto)
  @ApiPropertyOptional({ type: FlightPricingOptionsDto })
  options?: FlightPricingOptionsDto;
}
