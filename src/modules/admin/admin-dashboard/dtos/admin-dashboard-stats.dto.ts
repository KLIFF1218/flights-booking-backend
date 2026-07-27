import { ApiProperty } from '@nestjs/swagger';
import { EventAnalyticsDto } from './event-analytics.dto';

export class MonthlyRevenueDto {
  @ApiProperty({ example: '2026-05', description: 'Report month in YYYY-MM format' })
  month!: string;

  @ApiProperty({ example: 1200000, description: 'Revenue for the month in the charged currency' })
  revenue!: number;
}

export class BookingStatusDto {
  @ApiProperty({ example: 'CONFIRMED', description: 'Booking status' })
  name!: string;

  @ApiProperty({ example: 254, description: 'Number of bookings with this status' })
  value!: number;
}

export class TopRouteDto {
  @ApiProperty({ example: 'SVO-LED', description: 'Route with the highest number of bookings' })
  route!: string;

  @ApiProperty({ example: 125, description: 'Number of bookings for the route' })
  bookings!: number;
}

export class DashboardStatsDto {
  @ApiProperty({ example: 5230, description: 'Total number of users' })
  totalUsers!: number;

  @ApiProperty({ example: 1420, description: 'Total number of bookings' })
  totalBookings!: number;

  @ApiProperty({ example: 9876540, description: 'Total revenue for the period' })
  totalRevenue!: number;

  @ApiProperty({ example: 5.2, description: 'User growth in percent' })
  usersGrowth!: number;

  @ApiProperty({ example: 3.8, description: 'Booking growth in percent' })
  bookingsGrowth!: number;

  @ApiProperty({ example: 4.1, description: 'Revenue growth in percent' })
  revenueGrowth!: number;

  @ApiProperty({ example: 25, description: 'Number of active flights' })
  activeFlights!: number;

  @ApiProperty({
    example: 2,
    description: 'Change in active flights count relative to the previous period',
  })
  activeFlightsDelta!: number;

  @ApiProperty({ type: [MonthlyRevenueDto], description: 'Revenue by month' })
  monthlyRevenue!: MonthlyRevenueDto[];

  @ApiProperty({ type: [BookingStatusDto], description: 'Bookings by status' })
  bookingsByStatus!: BookingStatusDto[];

  @ApiProperty({ type: [TopRouteDto], description: 'Top routes by bookings' })
  topRoutes!: TopRouteDto[];

  @ApiProperty({
    type: EventAnalyticsDto,
    description: 'Booking event counts projected from Kafka domain events',
  })
  eventAnalytics!: EventAnalyticsDto;
}
