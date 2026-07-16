import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class BookingUserDto {
  @ApiProperty({ example: 'Иван' })
  firstName!: string;

  @ApiProperty({ example: 'Иванов' })
  lastName!: string;
}

export class BookingFlightDto {
  @ApiProperty({ example: 'SU123' })
  number!: string;

  @ApiProperty({ example: 'SVO' })
  from!: string;

  @ApiProperty({ example: 'LED' })
  to!: string;

  @ApiPropertyOptional({ format: 'date-time', example: '2026-06-01T10:00:00.000Z' })
  departureDate?: string | null;

  @ApiProperty({ example: 180 })
  durationMinutes!: number;

  @ApiProperty({ example: 'Aeroflot' })
  airline!: string;
}

export class BookingTransactionDto {
  @ApiProperty({ example: 'tr_abc123' })
  id!: string;

  @ApiProperty({ example: 'PAID' })
  status!: string;
}

export class BookingAdminDto {
  @ApiProperty({ example: 'bk_123' })
  id!: string;

  @ApiProperty({ type: BookingUserDto })
  user!: BookingUserDto;

  @ApiProperty({ type: BookingFlightDto })
  flight!: BookingFlightDto;

  @ApiProperty({ example: 2 })
  passengersCount!: number;

  @ApiProperty({ example: 12345 })
  totalPrice!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({
    enum: BookingStatus,
    example: BookingStatus.PAID,
  })
  status!: BookingStatus;

  @ApiPropertyOptional({ type: BookingTransactionDto })
  transaction?: BookingTransactionDto;
}

export class MetaDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class BookingsListResponseDto {
  @ApiProperty({ type: [BookingAdminDto] })
  data!: BookingAdminDto[];

  @ApiProperty({ type: MetaDto })
  meta!: MetaDto;
}

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'Новый статус бронирования',
    enum: BookingStatus,
    example: BookingStatus.PAID,
  })
  status!: BookingStatus;
}
