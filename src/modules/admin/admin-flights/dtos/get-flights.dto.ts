import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetFlightsQueryDto {
  @ApiPropertyOptional({
    example: 'on-time',
    description: 'Flight status: on-time | delayed | cancelled | completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'SU123',
    description: 'Search by flight number, airline, or IATA code',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of records per page',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
