import { ApiProperty } from '@nestjs/swagger';

export class AirportLocationDto {
  @ApiProperty({ example: 'airport_1' })
  id!: string;

  @ApiProperty({ example: 'Sheremetyevo' })
  name!: string;

  @ApiProperty({ example: 'Moscow', required: false })
  city!: string | null;

  @ApiProperty({ example: 'Russia' })
  country!: string;

  @ApiProperty({ example: 'SVO', required: false })
  iataCode!: string | null;
}

export class AirportsMetaDto {
  @ApiProperty({ example: 120 })
  count!: number;
}

export class AirportsResponseDto {
  @ApiProperty({ type: [AirportLocationDto] })
  data!: AirportLocationDto[];

  @ApiProperty({ type: AirportsMetaDto })
  meta!: AirportsMetaDto;
}
