import { ApiProperty } from '@nestjs/swagger';

export class AirportTimeDto {
  @ApiProperty({ example: 'SFO' })
  airport!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z' })
  time!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z' })
  date!: string;

  @ApiProperty({ example: '2026-03-08', required: false })
  localDate?: string;

  @ApiProperty({ example: '07:55', required: false })
  localTime?: string;

  @ApiProperty({ example: 'America/Los_Angeles', required: false })
  timezone?: string;
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

  @ApiProperty({ example: '2026-03-08', required: false })
  departureLocalDate?: string;

  @ApiProperty({ example: '07:55', required: false })
  departureLocalTime?: string;

  @ApiProperty({ example: 'America/Los_Angeles', required: false })
  departureTimezone?: string;

  @ApiProperty({ example: '2026-03-08', required: false })
  arrivalLocalDate?: string;

  @ApiProperty({ example: '16:29', required: false })
  arrivalLocalTime?: string;

  @ApiProperty({ example: 'America/New_York', required: false })
  arrivalTimezone?: string;

  @ApiProperty({ example: 'Delta Air Lines', description: 'Airline display name' })
  airline!: string;

  @ApiProperty({ example: 'DL', description: 'Airline IATA code' })
  airlineIata!: string;

  @ApiProperty({ example: 'DL123' })
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

  @ApiProperty({ example: 'Delta Air Lines', description: 'Primary airline display name' })
  airline!: string;

  @ApiProperty({ type: [FlightSegmentDto] })
  segments!: FlightSegmentDto[];

  @ApiProperty({ example: 'DL', description: 'Primary airline IATA code' })
  airlineIata!: string;
}

export class FlightCardResponse {
  @ApiProperty({ example: '1' })
  offerId!: string;

  @ApiProperty({
    example: 'INTERNAL_DB',
    description: 'Inventory source. Offers are built from the local PostgreSQL catalog.',
  })
  source!: string;

  @ApiProperty({
    example: 'LIGHT',
    description: 'Demo fare family (LIGHT = basic, FLEX = flexible). Not ATPCO branded fares.',
  })
  fareBrand!: string;

  @ApiProperty({ type: PriceDto })
  price!: PriceDto;

  @ApiProperty({ example: 'ECONOMY' })
  cabin!: string;

  @ApiProperty({ example: 0, description: 'Included checked bags for the selected demo brand' })
  checkedBags!: number;

  @ApiProperty({ example: false, description: 'Demo brand allows changes' })
  changeable!: boolean;

  @ApiProperty({ example: false, description: 'Demo brand allows refunds' })
  refundable!: boolean;

  @ApiProperty({ type: [FlightRouteDto] })
  routes!: FlightRouteDto[];

  @ApiProperty({ example: 334 })
  totalDurationMinutes!: number;
}
