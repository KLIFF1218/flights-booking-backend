import { ApiProperty } from '@nestjs/swagger';

export class TicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  travelerId!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  previewUrl!: string | null;

  @ApiProperty({ nullable: true })
  downloadUrl!: string | null;
}

export class TravelerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true })
  seatNumber!: string | null;
}

export class BookingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  pnr!: string;

  @ApiProperty()
  snapshot!: unknown;

  @ApiProperty({ nullable: true })
  userEmail!: string | null;

  @ApiProperty({ type: [TravelerDto] })
  travelers!: TravelerDto[];

  @ApiProperty({ type: [TicketDto] })
  tickets!: TicketDto[];
}

export class TransactionStatusResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  externalId!: string | null;

  @ApiProperty()
  bookingId!: string;

  @ApiProperty({ nullable: true })
  bookingStatus!: string | null;

  @ApiProperty({
    type: BookingDto,
    nullable: true,
  })
  booking!: BookingDto | null;
}
