import { ApiProperty } from '@nestjs/swagger';

export class AirportTimeDto {
  @ApiProperty({ example: 'SFO' })
  airport!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00' })
  time!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00' })
  date!: string;
}

export class PriceDto {
  @ApiProperty({ example: 61878 })
  total!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

export class FlightSegmentDto {
  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00' })
  departureTime!: string;

  @ApiProperty({ example: '2026-03-08T16:29:00' })
  arrivalTime!: string;

  @ApiProperty({ example: 'AS' })
  airline!: string;

  @ApiProperty({ example: '211' })
  flightNumber!: string;

  @ApiProperty({ example: 334 })
  durationMinutes!: number;
}

export class FlightRouteDto {
  @ApiProperty({ example: 5 })
  availableSeats!: number;

  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ type: AirportTimeDto })
  departure!: AirportTimeDto;

  @ApiProperty({ type: AirportTimeDto })
  arrival!: AirportTimeDto;

  @ApiProperty({ example: 334 })
  durationMinutes!: number;

  @ApiProperty({ example: 0 })
  stops!: number;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [],
  })
  stopCodes!: string[];

  @ApiProperty({ example: 'AS' })
  airline!: string;

  @ApiProperty({ type: [FlightSegmentDto] })
  segments!: FlightSegmentDto[];

  @ApiProperty({ example: 'AS' })
  airlineIata!: string;
}

export class FlightCardResponse {
  @ApiProperty({ example: '1' })
  offerId!: string;

  @ApiProperty({ type: PriceDto })
  price!: PriceDto;

  @ApiProperty({ type: [FlightRouteDto] })
  routes!: FlightRouteDto[];

  @ApiProperty({ example: 334 })
  totalDurationMinutes!: number;
}
