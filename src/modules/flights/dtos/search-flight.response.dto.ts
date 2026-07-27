import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlightCardResponse } from '../interfaces/flight-response.dto';

export class SearchFlightsMetaDto {
  @ApiProperty({ example: 42, description: 'Total offers after filters' })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;
}

export class SearchFlightsLinksDto {
  @ApiPropertyOptional({
    example: '/api/v1/flights/search/abc?cursor=...&limit=20&sort=CHEAPEST',
    nullable: true,
  })
  next!: string | null;
}

export class SearchAirlineFilterDto {
  @ApiProperty({ example: 'SU' })
  code!: string;

  @ApiProperty({ example: 'Aeroflot' })
  name!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class SearchFlightsFiltersDto {
  @ApiPropertyOptional({ example: 4500 })
  minPrice?: number;

  @ApiPropertyOptional({ example: 89000 })
  maxPrice?: number;

  @ApiPropertyOptional({ type: [SearchAirlineFilterDto] })
  airlines?: SearchAirlineFilterDto[];

  @ApiPropertyOptional({
    example: [
      { value: 0, count: 10 },
      { value: 1, count: 5 },
    ],
  })
  stops?: Array<{ value: number; count: number }>;

  @ApiPropertyOptional({
    example: [
      { value: 'SHORT', count: 8 },
      { value: 'MEDIUM', count: 4 },
    ],
  })
  durations?: Array<{ value: string; count: number }>;
}

/**
 * Matches FlightsService.buildSearchResponse runtime payload.
 * Offers are INTERNAL_DB inventory with indicative LIGHT/FLEX demo fares (not ATPCO/GDS).
 */
export class SearchFlightsResponse {
  @ApiProperty({
    example: 'a611b114-d1ae-4975-beaa-65991690d8cd',
    description: 'Unique identifier of the flight search session',
  })
  searchId!: string;

  @ApiProperty({
    type: [FlightCardResponse],
    description:
      'Page of flight offer cards from internal inventory (source=INTERNAL_DB, default fareBrand=LIGHT)',
  })
  data!: FlightCardResponse[];

  @ApiProperty({ type: SearchFlightsMetaDto })
  meta!: SearchFlightsMetaDto;

  @ApiProperty({ type: SearchFlightsLinksDto })
  links!: SearchFlightsLinksDto;

  @ApiPropertyOptional({
    example: '2026-07-25T12:15:00.000Z',
    nullable: true,
    description: 'Search session cache expiry (ISO)',
  })
  expiresAt!: string | null;

  @ApiProperty({ type: SearchFlightsFiltersDto, description: 'Facet counts for the full result set' })
  filters!: SearchFlightsFiltersDto;
}
