import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { TransactionResponseDto } from './transaction-response.dto';

export class BookingResponse {
  @ApiProperty({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'Booking ID',
  })
  id!: string;

  @ApiProperty({
    example: 'BK-2025-abcdef12',
    description: 'Booking number',
  })
  bookingNumber!: string | null;

  @ApiProperty({ example: 'John', description: 'Passenger first name' })
  passengerName!: string;

  @ApiProperty({ example: 'Doe', description: 'Passenger last name' })
  passengerLastName!: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Passenger email',
  })
  passengerEmail!: string;

  @ApiProperty({ example: 'BUSINESS', description: 'Travel class' })
  tripClass!: string;

  @ApiProperty({ example: 2, description: 'Number of seats' })
  seats!: number;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.PNR_CREATED })
  status!: BookingStatus;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    type: () => TransactionResponseDto,
    description: 'Payment information, if it exists',
    required: false,
  })
  transaction?: TransactionResponseDto;
}
