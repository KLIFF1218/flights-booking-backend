import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { TransactionResponseDto } from './transaction-response.dto';

export class BookingResponse {
  @ApiProperty({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'ID брони',
  })
  id!: string;

  @ApiProperty({
    example: 'BK-2025-abcdef12',
    description: 'Номер бронирования',
  })
  bookingNumber!: string | null;

  @ApiProperty({ example: 'John', description: 'Имя пассажира' })
  passengerName!: string;

  @ApiProperty({ example: 'Doe', description: 'Фамилия пассажира' })
  passengerLastName!: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email пассажира',
  })
  passengerEmail!: string;

  @ApiProperty({ example: 'BUSINESS', description: 'Класс перелёта' })
  tripClass!: string;

  @ApiProperty({ example: 2, description: 'Количество мест' })
  seats!: number;

  status!: BookingStatus;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    type: () => TransactionResponseDto,
    description: 'Информация о платеже, если он существует',
    required: false,
  })
  transaction?: TransactionResponseDto;
}
