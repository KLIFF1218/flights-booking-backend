import { ApiProperty } from '@nestjs/swagger';
import { AdminFlightInstanceDto } from './admin-flight-response.dto';

export class AdminFlightsStatsDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 30 })
  onTime!: number;

  @ApiProperty({ example: 5 })
  delayed!: number;

  @ApiProperty({ example: 4 })
  completed!: number;

  @ApiProperty({ example: 3 })
  cancelled!: number;

  @ApiProperty({ example: 68 })
  occupancy!: number;
}

export class AdminFlightsListMetaDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class AdminFlightsListResponseDto {
  @ApiProperty({ type: [AdminFlightInstanceDto] })
  data!: AdminFlightInstanceDto[];

  @ApiProperty({ type: AdminFlightsListMetaDto })
  meta!: AdminFlightsListMetaDto;

  @ApiProperty({ type: AdminFlightsStatsDto })
  stats!: AdminFlightsStatsDto;
}
