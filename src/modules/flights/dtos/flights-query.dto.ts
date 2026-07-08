import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';

export enum SortType {
  CHEAPEST = 'CHEAPEST',
  FASTEST = 'FASTEST',
  BEST = 'BEST',
  DEPARTURE = 'DEPARTURE',
  ARRIVAL = 'ARRIVAL',
}

export class FlightsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SortType)
  sort?: SortType;

  @IsOptional()
  @IsString()
  cursor?: string;
}
