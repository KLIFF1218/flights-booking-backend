import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
