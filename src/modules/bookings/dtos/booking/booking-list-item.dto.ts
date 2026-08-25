import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, BookingProvider, Currency } from '@prisma/client';

export class BookingListOperationalAlertDto {
  @ApiProperty({ example: 'DELAYED', enum: ['CANCELLED', 'DELAYED'] })
  type!: 'CANCELLED' | 'DELAYED';

  @ApiProperty({ example: 'Flight delayed by 45 min.' })
  message!: string;

  @ApiPropertyOptional({ example: 45, nullable: true })
  delayMinutes!: number | null;
}

export class BookingListFlightDto {
  @ApiProperty({ example: 'SU100' })
  number!: string;

  @ApiProperty({ example: 'SVO' })
  from!: string;

  @ApiProperty({ example: 'LED' })
  to!: string;

  @ApiPropertyOptional({ example: '2026-08-01T10:00:00.000Z', nullable: true })
  departureDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-01T12:00:00.000Z', nullable: true })
  arrivalDate!: string | null;

  @ApiProperty({ example: 'SU' })
  airline!: string;
}

export class BookingListRouteDto {
  @ApiProperty({ example: 'SVO' })
  from!: string;

  @ApiProperty({ example: 'LED' })
  to!: string;

  @ApiProperty({ example: '2026-08-01T10:00:00.000Z' })
  departureDate!: string;

  @ApiProperty({ example: '2026-08-01T12:00:00.000Z' })
  arrivalDate!: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  departureLocalDate?: string;

  @ApiPropertyOptional({ example: '10:00' })
  departureLocalTime?: string;

  @ApiPropertyOptional({ example: 'Europe/Moscow' })
  departureTimezone?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  arrivalLocalDate?: string;

  @ApiPropertyOptional({ example: '12:00' })
  arrivalLocalTime?: string;

  @ApiPropertyOptional({ example: 'Europe/Moscow' })
  arrivalTimezone?: string;

  @ApiProperty({ example: 'SU100' })
  number!: string;

  @ApiProperty({ example: 'SU' })
  airline!: string;

  @ApiProperty({ example: 0 })
  stops!: number;
}

export class BookingListTravelerDto {
  @ApiProperty({ example: 'trav-1' })
  id!: string;

  @ApiProperty({ example: 'Ivan' })
  firstName!: string;

  @ApiProperty({ example: 'Ivanov' })
  lastName!: string;

  @ApiPropertyOptional({ example: '12A', nullable: true })
  seatNumber!: string | null;
}

export class BookingListTicketDto {
  @ApiProperty({ example: 'ticket-1' })
  id!: string;

  @ApiProperty({ example: 'trav-1' })
  travelerId!: string;

  @ApiProperty({ example: 'SC-123456' })
  ticketNumber!: string;

  @ApiProperty({ example: 'ISSUED' })
  status!: string;
}

export class BookingListTransactionDto {
  @ApiProperty({ example: 'tx-1' })
  id!: string;
}

export class BookingListItemDto {
  @ApiProperty({ example: 'booking-1' })
  id!: string;

  @ApiProperty({ example: 'ABC123' })
  pnrLocator!: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.PNR_CREATED })
  status!: BookingStatus;

  @ApiProperty({ example: 10000 })
  totalPrice!: number;

  @ApiProperty({ enum: Currency, example: Currency.RUB })
  currency!: Currency;

  @ApiProperty({ example: 'order-1' })
  flightOrderId!: string;

  @ApiProperty({ example: '2026-08-01T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T23:59:59.000Z' })
  lastTicketingDate!: Date;

  @ApiProperty({ enum: BookingProvider, example: BookingProvider.INTERNAL })
  provider!: BookingProvider;

  @ApiProperty({ type: [BookingListRouteDto] })
  routes!: BookingListRouteDto[];

  @ApiProperty({ type: BookingListFlightDto })
  flight!: BookingListFlightDto;

  @ApiPropertyOptional({ type: BookingListOperationalAlertDto, nullable: true })
  operationalAlert!: BookingListOperationalAlertDto | null;

  @ApiProperty({ example: 'ECONOMY' })
  cabin!: string;

  @ApiProperty({ example: 1 })
  passengersCount!: number;

  @ApiProperty({ type: [BookingListTravelerDto] })
  travelers!: BookingListTravelerDto[];

  @ApiProperty({ type: [BookingListTicketDto] })
  tickets!: BookingListTicketDto[];

  @ApiPropertyOptional({ type: BookingListTransactionDto, nullable: true })
  transaction!: BookingListTransactionDto | null;
}
