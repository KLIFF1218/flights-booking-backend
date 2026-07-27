import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AirportLocationDto {
  @ApiProperty({ example: 'airport_1' })
  id!: string;

  @ApiProperty({ example: 'Sheremetyevo International Airport' })
  name!: string;

  @ApiProperty({ example: 'Moscow' })
  city!: string;

  @ApiProperty({ example: 'Russia' })
  country!: string;

  @ApiProperty({ example: 'SVO' })
  iataCode!: string;

  @ApiPropertyOptional({ example: 'UUEE' })
  icaoCode?: string | null;

  @ApiPropertyOptional({ example: 55.972599 })
  latitude?: number | null;

  @ApiPropertyOptional({ example: 37.4146 })
  longitude?: number | null;
}

export class AirportsMetaDto {
  @ApiProperty({ example: 10 })
  count!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({
    example: 'eyJjaXR5IjoiTW9zY293IiwibmFtZSI6IlNoZXJlbWV0eWV2byIsImlkIjoiLi4uIn0',
    nullable: true,
  })
  nextCursor!: string | null;
}

export class AirportsResponseDto {
  @ApiProperty({ type: [AirportLocationDto] })
  data!: AirportLocationDto[];

  @ApiProperty({ type: AirportsMetaDto })
  meta!: AirportsMetaDto;
}
