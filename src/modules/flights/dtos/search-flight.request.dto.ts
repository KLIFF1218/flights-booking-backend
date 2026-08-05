import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  Validate,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  DistinctAirportsConstraint,
  IataCodeConstraint,
  IsoDateConstraint,
  RoundTripDatesConstraint,
  RoundTripRouteConstraint,
  TodayOrFutureDateConstraint,
} from '../validators/search-directions.validator';
import { normalizeIataCode } from '../utils/search/validate-search-directions.util';
import { CurrencyCode } from 'src/shared/currency/currency-code.enum';

export enum TravelClass {
  ECONOMY = 'ECONOMY',
  PREMIUM_ECONOMY = 'PREMIUM_ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export { CurrencyCode };

export class DirectionDto {
  @ApiProperty({ example: 'HEL' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeIataCode(value) : value,
  )
  @IsString()
  @Length(3, 3)
  @Validate(IataCodeConstraint)
  origin!: string;

  @ApiProperty({ example: 'JFK' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeIataCode(value) : value,
  )
  @IsString()
  @Length(3, 3)
  @Validate(IataCodeConstraint)
  @Validate(DistinctAirportsConstraint)
  destination!: string;

  @ApiProperty({
    example: '2026-04-01',
    description:
      'Local departure date at the origin airport (YYYY-MM-DD). Round-trip return uses a second direction.',
  })
  @IsString()
  @Validate(IsoDateConstraint)
  @Validate(TodayOrFutureDateConstraint)
  dateFrom!: string;
}

export class PassengersDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  infants?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  seatedInfants?: number;
}

export class SearchFlightsDto {
  @ApiProperty({ type: [DirectionDto], description: 'List of directions for the flight search' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @Validate(RoundTripRouteConstraint)
  @Validate(RoundTripDatesConstraint)
  @ValidateNested({ each: true })
  @Type(() => DirectionDto)
  directions!: DirectionDto[];

  @ApiProperty({ type: PassengersDto, description: 'Passenger details for the flight search' })
  @ValidateNested()
  @Type(() => PassengersDto)
  passengers!: PassengersDto;

  @ApiProperty({
    enum: TravelClass,
    example: TravelClass.ECONOMY,
    description: 'The class of travel for the flight',
  })
  @IsEnum(TravelClass)
  travelClass!: TravelClass;

  @ApiProperty({
    enum: CurrencyCode,
    example: CurrencyCode.USD,
    required: false,
    description:
      'Currency for flight prices. Defaults to USD (Stripe) or RUB (YooKassa) based on PAYMENT_PROVIDER_DEFAULT.',
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currencyCode?: CurrencyCode;
}
