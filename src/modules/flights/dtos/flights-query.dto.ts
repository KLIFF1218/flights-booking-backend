import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortType {
  CHEAPEST = 'CHEAPEST',
  FASTEST = 'FASTEST',
  BEST = 'BEST',
  DEPARTURE = 'DEPARTURE',
  ARRIVAL = 'ARRIVAL',
}

export class FlightsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    description: 'Number of results per page (1-50)',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SortType, description: 'Sort results' })
  @IsOptional()
  @IsEnum(SortType)
  sort?: SortType;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Minimum price', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price', example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Filter by stops (CSV), e.g.: 0,1',
    example: '0,1',
  })
  @IsOptional()
  @IsString()
  stops?: string;

  @ApiPropertyOptional({
    description: 'Filter by airlines (CSV IATA), e.g.: SU,DP',
    example: 'SU,DP',
  })
  @IsOptional()
  @IsString()
  airlines?: string;

  @ApiPropertyOptional({
    description: 'Filter by duration (CSV): UP_TO_5H, FROM_5_TO_10H, FROM_10_TO_15H, OVER_15H',
    example: 'UP_TO_5H,FROM_5_TO_10H',
  })
  @IsOptional()
  @IsString()
  durations?: string;
}
