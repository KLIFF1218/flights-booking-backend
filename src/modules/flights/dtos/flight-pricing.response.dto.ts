import type { Currency, PassengerType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  FareDetailsBySegment,
  FeeLineItem,
  TaxLineItem,
} from '../interfaces/flight-offers.interface';
export interface FlightPricingResponse {
  id: string;
  quoteId: string;
  quotedAt: string;
  expiresAt: string;

  /** Always INTERNAL_DB — prices come from own inventory simulator. */
  source?: string;
  /** indicative = demo fare construction, not ATPCO/GDS ticket stock. */
  pricingMode?: 'indicative';
  fareBrand?: string;

  price: FlightPrice;

  travelers: FlightTraveler[];

  outbound: FlightDirection;
  inbound?: FlightDirection;

  scheduleChanged?: boolean;
  operationalStatus?: string;
  delayMinutes?: number;
  scheduleChanges?: ScheduleChange[];
  fxRates?: Record<string, number>;
  fxRatesAt?: string;
  seatsPricingMode?: 'indicative';
}

export interface ScheduleChange {
  flightInstanceId: string;
  segmentId: string;
  previousDepartureTime: string;
  currentDepartureTime: string;
  previousArrivalTime: string;
  currentArrivalTime: string;
  delayMinutes: number;
}

export interface FlightPrice {
  base: number;
  taxes: number;
  fees: number;
  taxItems: TaxLineItem[];
  feeItems: FeeLineItem[];
  seats: number;
  total: number;
  currency: Currency;

  baggage?: number;
  meals?: number;
  otherServices?: number;
}

export interface FlightTraveler {
  travelerId: string;
  fareOption: string;
  travelerType: PassengerType;

  price: {
    currency: Currency;
    total: string;
    base: string;
    taxes?: TaxLineItem[];
    fees?: FeeLineItem[];
  };

  fareDetailsBySegment: FareDetailsBySegment[];
}

export enum TravelerType {
  ADULT = 'ADULT',
  CHILD = 'CHILD',
  INFANT = 'HELD_INFANT',
  SEATED_INFANT = 'SEATED_INFANT',
}

export interface FlightDirection {
  from: string;
  to: string;

  departureTime: string;
  arrivalTime: string;

  departureLocalDate?: string;
  departureLocalTime?: string;
  departureTimezone?: string;
  arrivalLocalDate?: string;
  arrivalLocalTime?: string;
  arrivalTimezone?: string;

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

  departureLocalDate?: string;
  departureLocalTime?: string;
  departureTimezone?: string;
  arrivalLocalDate?: string;
  arrivalLocalTime?: string;
  arrivalTimezone?: string;

  /** @deprecated Use airlineIata — kept for backward compatibility */
  airline: string;
  airlineName: string;
  airlineIata: string;
  flightNumber: string;
}

export class FlightSegmentDto {
  @ApiProperty({ example: 'seg_1', description: 'Segment identifier' })
  segmentId!: string;

  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z' })
  departureTime!: string;

  @ApiProperty({ example: '2026-03-08T16:29:00.000Z' })
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

  @ApiProperty({
    example: 'DL',
    description: 'Airline IATA code (deprecated alias, prefer airlineIata)',
  })
  airline!: string;

  @ApiProperty({ example: 'Delta Air Lines', description: 'Airline display name' })
  airlineName!: string;

  @ApiProperty({ example: 'DL', description: 'Airline IATA code' })
  airlineIata!: string;

  @ApiProperty({ example: '211', description: 'Flight number' })
  flightNumber!: string;
}

export class FlightDirectionDto {
  @ApiProperty({ example: 'SFO' })
  from!: string;

  @ApiProperty({ example: 'JFK' })
  to!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z' })
  departureTime!: string;

  @ApiProperty({ example: '2026-03-08T16:29:00.000Z' })
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

  @ApiProperty({ example: 130, description: 'Total taxes on top of base fare' })
  taxes!: number;

  @ApiProperty({ example: 10, description: 'Total booking/service fees' })
  fees!: number;

  @ApiProperty({
    example: [
      { code: 'YQ', amount: '80.00' },
      { code: 'YR', amount: '50.00' },
    ],
    description: 'Tax line items',
  })
  taxItems!: TaxLineItem[];

  @ApiProperty({
    example: [{ type: 'SERVICE_FEE', amount: '10.00' }],
    description: 'Fee line items',
  })
  feeItems!: FeeLineItem[];

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

export class FlightTravelerPriceDto {
  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({ example: '4500.00' })
  total!: string;

  @ApiProperty({ example: '3900.00' })
  base!: string;

  @ApiProperty({
    required: false,
    example: [
      { code: 'YQ', amount: '312.00' },
      { code: 'YR', amount: '195.00' },
    ],
  })
  taxes?: TaxLineItem[];

  @ApiProperty({
    required: false,
    example: [{ type: 'SERVICE_FEE', amount: '5.00' }],
  })
  fees?: FeeLineItem[];
}

export class FlightTravelerDto {
  @ApiProperty({ example: 'trav_1' })
  travelerId!: string;

  @ApiProperty({
    example: 'LIGHT',
    description: 'Demo fare brand for this traveler (LIGHT/FLEX). Not an airline branded fare code.',
  })
  fareOption!: string;

  @ApiProperty({ example: TravelerType.ADULT, enum: TravelerType })
  travelerType!: TravelerType;

  @ApiProperty({ type: FlightTravelerPriceDto })
  price!: FlightTravelerPriceDto;
}

export class ScheduleChangeDto {
  @ApiProperty()
  flightInstanceId!: string;

  @ApiProperty()
  segmentId!: string;

  @ApiProperty()
  previousDepartureTime!: string;

  @ApiProperty()
  currentDepartureTime!: string;

  @ApiProperty()
  previousArrivalTime!: string;

  @ApiProperty()
  currentArrivalTime!: string;

  @ApiProperty({ example: 15 })
  delayMinutes!: number;
}

export class FlightPricingResponseDto {
  @ApiProperty({ example: 'prc_1' })
  id!: string;

  @ApiProperty({ example: 'quote_abc123' })
  quoteId!: string;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z' })
  quotedAt!: string;

  @ApiProperty({ example: '2026-03-08T08:10:00.000Z' })
  expiresAt!: string;

  @ApiProperty({
    example: 'INTERNAL_DB',
    description: 'Inventory source. This API prices only from the local PostgreSQL catalog.',
  })
  source!: string;

  @ApiProperty({
    example: 'indicative',
    description:
      'Indicative simulator pricing over internal inventory. Not ATPCO/GDS fares. Child/infant multipliers and tax lines are configurable demo rules.',
  })
  pricingMode!: 'indicative';

  @ApiProperty({
    example: 'LIGHT',
    description: 'Demo fare family used for this quote (LIGHT or FLEX).',
  })
  fareBrand!: string;

  @ApiProperty({ type: FlightPriceDto })
  price!: FlightPriceDto;

  @ApiProperty({ type: [FlightTravelerDto] })
  travelers!: FlightTravelerDto[];

  @ApiProperty({ type: FlightDirectionDto })
  outbound!: FlightDirectionDto;

  @ApiProperty({ type: FlightDirectionDto, required: false })
  inbound?: FlightDirectionDto;

  @ApiProperty({ example: false, required: false })
  scheduleChanged?: boolean;

  @ApiProperty({ example: 'DELAYED', required: false })
  operationalStatus?: string;

  @ApiProperty({ example: 15, required: false })
  delayMinutes?: number;

  @ApiProperty({ type: [ScheduleChangeDto], required: false })
  scheduleChanges?: ScheduleChangeDto[];

  @ApiProperty({
    required: false,
    example: { USD: 1, RUB: 90.5, EUR: 0.92 },
    description: 'FX table snapshot locked into the quote',
  })
  fxRates?: Record<string, number>;

  @ApiProperty({ example: '2026-03-08T07:55:00.000Z', required: false })
  fxRatesAt?: string;

  @ApiProperty({
    example: 'indicative',
    required: false,
    description: 'Present when seat prices are indicative (revalidated at booking)',
  })
  seatsPricingMode?: 'indicative';
}
