import { ApiProperty } from '@nestjs/swagger';

export class AirportResponseDto {
  @ApiProperty({
    description: 'Unique airport identifier',
    example: 'clh4j3k4l9m5n6o7p8q9r0s1',
  })
  id!: string;

  @ApiProperty({
    description: 'Airport name',
    example: 'Sheremetyevo',
  })
  name!: string;

  @ApiProperty({
    description: 'City where the airport is located',
    example: 'Moscow',
  })
  city!: string;

  @ApiProperty({
    description: 'Airport IATA code (3 letters)',
    example: 'SVO',
  })
  iataCode!: string;
}

export class AirportsListResponseDto {
  @ApiProperty({
    type: [AirportResponseDto],
    description: 'List of all airports',
  })
  data!: AirportResponseDto[];
}
