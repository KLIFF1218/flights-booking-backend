import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, Currency } from '@prisma/client';
import { BookingListItemDto } from './booking-list-item.dto';

export class BookingDetailDto {
  @ApiProperty({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'Booking ID',
  })
  id!: string;

  @ApiProperty({
    example: 'cmlkwumde0000rou70qi84z9d',
    description: 'User ID',
  })
  userId!: string;

  @ApiProperty({
    example: 'ABC123',
    description: 'PNR locator (airline confirmation)',
  })
  pnrLocator!: string;

  @ApiProperty({
    example: '2025-01-20',
    description: 'Flight order ID',
  })
  flightOrderId!: string;

  @ApiProperty({
    enum: BookingStatus,
    example: BookingStatus.PNR_CREATED,
    description: 'Booking status',
  })
  status!: BookingStatus;

  @ApiProperty({
    example: 350.5,
    description: 'Total price',
  })
  totalPrice!: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Currency',
  })
  currency!: Currency;

  @ApiProperty({
    example: 'INTERNAL',
    description: 'Booking provider (INTERNAL = local inventory; no external GDS)',
  })
  provider!: string;

  @ApiProperty({
    example: '2025-12-25T23:59:59.000Z',
    description: 'Last ticketing date',
  })
  lastTicketingDate!: Date;

  @ApiProperty({
    example: '2025-12-25T23:59:59.000Z',
    description: 'Booking expiration date',
  })
  expiresAt!: Date;

  @ApiProperty({
    example: '2025-02-23T10:30:00.000Z',
    description: 'Creation date',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2025-02-23T10:30:00.000Z',
    description: 'Last update date',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: 'John Doe',
    description: 'Passenger full name',
  })
  passengerName!: string;

  @ApiProperty({
    example: 'SVO',
    description: 'Departure airport IATA code',
  })
  departureAirport!: string;

  @ApiProperty({
    example: '2025-03-15T14:30:00Z',
    description: 'Departure time',
  })
  departureTime!: string;

  @ApiProperty({
    example: 'JFK',
    description: 'Arrival airport IATA code',
  })
  arrivalAirport!: string;

  @ApiProperty({
    example: '2025-03-15T20:30:00Z',
    description: 'Arrival time',
  })
  arrivalTime!: string;

  @ApiProperty({
    example: 'ECONOMY',
    description: 'Cabin class',
  })
  cabin!: string;

  @ApiProperty({
    example: '12A',
    description: 'Seat number (may be null if not assigned)',
    required: false,
  })
  seatNumber?: string | null;

  @ApiProperty({
    example: 'SU',
    description: 'Airline code',
    required: false,
  })
  airlineCode?: string;

  @ApiProperty({
    description: 'Full flight data',
    additionalProperties: true,
    required: false,
  })
  snapshot?: Record<string, unknown>;
}

export class UserBookingsListDto {
  @ApiProperty({
    type: [BookingListItemDto],
    description: 'List of user bookings',
  })
  bookings!: BookingListItemDto[];

  @ApiProperty({
    example: 5,
    description: 'Total number of user bookings',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: 'Current page',
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: 'Page size',
  })
  limit!: number;

  @ApiProperty({
    example: 1,
    description: 'Total pages',
  })
  totalPages!: number;
}
