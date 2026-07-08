import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, Currency } from '@prisma/client';

export class BookingDetailDto {
  @ApiProperty({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'ID бронирования',
  })
  id!: string;

  @ApiProperty({
    example: 'cmlkwumde0000rou70qi84z9d',
    description: 'ID пользователя',
  })
  userId!: string;

  @ApiProperty({
    example: 'ABC123',
    description: 'PNR локатор (подтверждение от авиакомпании)',
  })
  pnrLocator!: string;

  @ApiProperty({
    example: '2025-01-20',
    description: 'ID рейса',
  })
  flightOrderId!: string;

  @ApiProperty({
    enum: BookingStatus,
    example: BookingStatus.PNR_CREATED,
    description: 'Статус бронирования',
  })
  status!: BookingStatus;

  @ApiProperty({
    example: 350.5,
    description: 'Общая стоимость',
  })
  totalPrice!: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Валюта',
  })
  currency!: Currency;

  @ApiProperty({
    example: 'AMADEUS',
    description: 'Провайдер (откуда забронировано)',
  })
  provider!: string;

  @ApiProperty({
    example: '2025-12-25T23:59:59.000Z',
    description: 'Последний день выписки билета',
  })
  lastTicketingDate!: Date;

  @ApiProperty({
    example: '2025-12-25T23:59:59.000Z',
    description: 'Дата истечения бронирования',
  })
  expiresAt!: Date;

  @ApiProperty({
    example: '2025-02-23T10:30:00.000Z',
    description: 'Дата создания',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2025-02-23T10:30:00.000Z',
    description: 'Дата последнего обновления',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: 'John Doe',
    description: 'ФИ пассажира',
  })
  passengerName!: string;

  @ApiProperty({
    example: 'SVO',
    description: 'IATA код аэропорта отправления',
  })
  departureAirport!: string;

  @ApiProperty({
    example: '2025-03-15T14:30:00Z',
    description: 'Время отправления',
  })
  departureTime!: string;

  @ApiProperty({
    example: 'JFK',
    description: 'IATA код аэропорта прибытия',
  })
  arrivalAirport!: string;

  @ApiProperty({
    example: '2025-03-15T20:30:00Z',
    description: 'Время прибытия',
  })
  arrivalTime!: string;

  @ApiProperty({
    example: 'ECONOMY',
    description: 'Класс кабины',
  })
  cabin!: string;

  @ApiProperty({
    example: '12A',
    description: 'Номер места (может быть null если не назначено)',
    required: false,
  })
  seatNumber?: string | null;

  @ApiProperty({
    example: 'SU',
    description: 'Код авиакомпании',
    required: false,
  })
  airlineCode?: string;

  @ApiProperty({
    description: 'Полные данные рейса',
    additionalProperties: true,
    required: false,
  })
  snapshot?: Record<string, unknown>;
}

export class UserBookingsListDto {
  @ApiProperty({
    type: [BookingDetailDto],
    description: 'Список бронирований пользователя',
  })
  bookings!: BookingDetailDto[];

  @ApiProperty({
    example: 5,
    description: 'Количество бронирований',
  })
  total!: number;
}
