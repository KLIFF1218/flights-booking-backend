import { ApiProperty } from '@nestjs/swagger';

export class BookingDomainEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  aggregateType!: string;

  @ApiProperty()
  aggregateId!: string;

  @ApiProperty({ type: Object })
  payload!: Record<string, unknown>;

  @ApiProperty()
  occurredAt!: string;
}

export class BookingDomainEventsResponseDto {
  @ApiProperty({ type: [BookingDomainEventDto] })
  data!: BookingDomainEventDto[];
}
