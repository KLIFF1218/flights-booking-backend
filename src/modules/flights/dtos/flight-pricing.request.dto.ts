import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SeatOptionDto {

  @IsString()
  travelerId: string;

  @IsString()
  segmentId: string;

  @IsString()
  seatNumber: string;
}

export class FlightPricingOptionsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatOptionDto)
  seats?: SeatOptionDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  infants?: number;
}

export class FlightPricingRequestDto {
  @IsString()
  searchId: string;

  @IsString()
  offerId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlightPricingOptionsDto)
  options?: FlightPricingOptionsDto;
}
