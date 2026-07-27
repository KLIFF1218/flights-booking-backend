import { ApiProperty } from '@nestjs/swagger';

export class EventAnalyticsHealthDto {
  @ApiProperty({
    nullable: true,
    example: '2026-07-26T16:42:00.000Z',
    description: 'When the analytics consumer last processed a domain event',
  })
  lastEventAt!: string | null;

  @ApiProperty({ example: 42, description: 'Total processed analytics events in the projection' })
  processedEventCount!: number;
}

export class EventAnalyticsCountsDto {
  @ApiProperty()
  bookingsCreated!: number;

  @ApiProperty()
  paymentsSucceeded!: number;

  @ApiProperty()
  paymentsFailed!: number;

  @ApiProperty()
  bookingsCanceled!: number;

  @ApiProperty()
  bookingsExpired!: number;

  @ApiProperty()
  ticketsIssued!: number;

  @ApiProperty()
  ticketingFailed!: number;

  @ApiProperty()
  flightsDelayed!: number;

  @ApiProperty()
  flightsCancelled!: number;
}

export class EventAnalyticsDailyActivityDto {
  @ApiProperty({ example: '2026-07-26' })
  date!: string;

  @ApiProperty()
  bookingsCreated!: number;

  @ApiProperty()
  paymentsSucceeded!: number;

  @ApiProperty()
  paymentsFailed!: number;

  @ApiProperty()
  bookingsCanceled!: number;

  @ApiProperty()
  bookingsExpired!: number;

  @ApiProperty()
  ticketsIssued!: number;

  @ApiProperty()
  ticketingFailed!: number;

  @ApiProperty()
  flightsDelayed!: number;

  @ApiProperty()
  flightsCancelled!: number;

  @ApiProperty()
  paymentVolume!: number;
}

export class EventAnalyticsDto {
  @ApiProperty({ example: 30 })
  periodDays!: number;

  @ApiProperty({ type: EventAnalyticsHealthDto })
  health!: EventAnalyticsHealthDto;

  @ApiProperty({ type: EventAnalyticsCountsDto, description: 'Domain event counts for the period' })
  counts!: EventAnalyticsCountsDto;

  @ApiProperty({ description: 'Created to paid rate (%)' })
  conversionRate!: number;

  @ApiProperty({ description: 'Paid to ticketed rate (%)' })
  ticketRate!: number;

  @ApiProperty({ description: 'Total payment volume from booking.paid events' })
  paymentVolume!: number;

  @ApiProperty({ type: [EventAnalyticsDailyActivityDto] })
  dailyActivity!: EventAnalyticsDailyActivityDto[];
}
