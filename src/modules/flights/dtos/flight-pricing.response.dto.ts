export interface FlightPricingResponse {
  id: string;

  price: FlightPrice;

  travelers: FlightTraveler[];

  outbound: FlightDirection;
  inbound?: FlightDirection;
}

export interface FlightPrice {
  base: number;
  seats: number;
  total: number;
  currency: string;

  baggage?: number;
  meals?: number;
  otherServices?: number;
}

export interface FlightTraveler {
  travelerId: string;
  travelerType: TravelerType;
}

export enum TravelerType {
  ADULT = 'ADULT',
  CHILD = 'CHILD',
  INFANT = 'HELD_INFANT',
  INFANT_SEATED = 'SEATED_INFANT',
}

export interface FlightDirection {
  from: string;
  to: string;

  departureTime: string;
  arrivalTime: string;

  durationMinutes: number;
  stops: number;

  segments: FlightSegment[];
}

export interface FlightSegment {
  segmentId: string;

  from: string;
  to: string;

  departureTime: string;
  arrivalTime: string;

  airline: string;
  flightNumber: string;
}
import { ApiProperty } from '@nestjs/swagger';

export class FlightSegmentDto {
  @ApiProperty({ example: 'seg_1', description: 'Идентификатор сегмента' })
  segmentId!: string;

  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00' })
  departureTime!: string;

  @ApiProperty({ example: '2026-03-08T16:29:00' })
  arrivalTime!: string;

  @ApiProperty({ example: 'AS', description: 'IATA авиакомпании' })
  airline!: string;

  @ApiProperty({ example: '211', description: 'Номер рейса' })
  flightNumber!: string;
}

export class FlightDirectionDto {
  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00' })
  departureTime!: string;

  @ApiProperty({ example: '2026-03-08T16:29:00' })
  arrivalTime!: string;

  @ApiProperty({ example: 334 })
  durationMinutes!: number;

  @ApiProperty({ example: 0 })
  stops!: number;

  @ApiProperty({ type: [FlightSegmentDto] })
  segments!: FlightSegmentDto[];
}

export class FlightPriceDto {
  @ApiProperty({ example: 1000 })
  base!: number;

  @ApiProperty({ example: 2 })
  seats!: number;

  @ApiProperty({ example: 2000 })
  total!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({ example: 0, required: false })
  baggage?: number;

  @ApiProperty({ example: 0, required: false })
  meals?: number;

  @ApiProperty({ example: 0, required: false })
  otherServices?: number;
}

export class FlightTravelerDto {
  @ApiProperty({ example: 'trav_1' })
  travelerId!: string;

  @ApiProperty({ example: TravelerType.ADULT, enum: TravelerType })
  travelerType!: TravelerType;
}

export class FlightPricingResponseDto {
  @ApiProperty({ example: 'prc_1' })
  id!: string;

  @ApiProperty({ type: FlightPriceDto })
  price!: FlightPriceDto;

  @ApiProperty({ type: [FlightTravelerDto] })
  travelers!: FlightTravelerDto[];

  @ApiProperty({ type: FlightDirectionDto })
  outbound!: FlightDirectionDto;

  @ApiProperty({ type: FlightDirectionDto, required: false })
  inbound?: FlightDirectionDto;
}
