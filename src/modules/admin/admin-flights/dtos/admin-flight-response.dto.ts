import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class AdminFlightInstanceDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  departureDate!: Date;

  @ApiProperty({ example: '2026-08-15T14:30:00.000Z' })
  arrivalDate!: Date;

  @ApiProperty({ example: 270 })
  durationMinutes!: number;

  @ApiProperty({ example: 15000 })
  price!: number;

  @ApiProperty({ enum: Currency, example: Currency.RUB })
  currency!: Currency;

  @ApiProperty({ example: 180 })
  totalSeats!: number;

  @ApiProperty({ example: 120 })
  availableSeats!: number;

  @ApiProperty({ example: 'SCHEDULED' })
  status!: string;

  @ApiProperty({ example: 0 })
  delayMinutes!: number;

  @ApiProperty({ example: 'SU123' })
  flightNumber!: string;

  @ApiProperty({ example: 'Aeroflot' })
  airline!: string;

  @ApiProperty({ example: 'SVO' })
  from!: string;

  @ApiProperty({ example: 'LED' })
  to!: string;
}

export class AdminFlightTemplateAirlineDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'Aeroflot' })
  name!: string;

  @ApiProperty({ example: 'SU' })
  code!: string;
}

export class AdminFlightTemplateAirportDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s1' })
  id!: string;

  @ApiProperty({ example: 'Sheremetyevo International Airport' })
  name!: string;

  @ApiProperty({ example: 'SVO' })
  iataCode!: string;

  @ApiProperty({ example: 'Moscow' })
  city!: string;

  @ApiProperty({ example: 'Europe/Moscow' })
  timezone!: string;
}

export class AdminFlightTemplateDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'SU123' })
  flightNumber!: string;

  @ApiProperty({ example: 90, description: 'Flight duration in minutes' })
  durationMinutes!: number;

  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s2' })
  airlineId!: string;

  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s3' })
  departureAirportId!: string;

  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s4' })
  arrivalAirportId!: string;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    example: false,
    description: 'Whether First class adult price is required for this airline',
  })
  supportsFirstClass!: boolean;

  @ApiProperty({ type: AdminFlightTemplateAirlineDto })
  airline!: AdminFlightTemplateAirlineDto;

  @ApiProperty({ type: AdminFlightTemplateAirportDto })
  departureAirport!: AdminFlightTemplateAirportDto;

  @ApiProperty({ type: AdminFlightTemplateAirportDto })
  arrivalAirport!: AdminFlightTemplateAirportDto;
}
