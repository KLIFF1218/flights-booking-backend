import { ApiProperty } from '@nestjs/swagger';

export class MonthlyRevenueDto {
  @ApiProperty({ example: '2026-05', description: 'Месяц отчета в формате YYYY-MM' })
  month!: string;

  @ApiProperty({ example: 1200000, description: 'Доход за месяц в начисленной валюте' })
  revenue!: number;
}

export class BookingStatusDto {
  @ApiProperty({ example: 'CONFIRMED', description: 'Статус бронирования' })
  name!: string;

  @ApiProperty({ example: 254, description: 'Количество бронирований с данным статусом' })
  value!: number;
}

export class TopRouteDto {
  @ApiProperty({ example: 'SVO-LED', description: 'Маршрут с наибольшим количеством бронирований' })
  route!: string;

  @ApiProperty({ example: 125, description: 'Количество бронирований по маршруту' })
  bookings!: number;
}

export class DashboardStatsDto {
  @ApiProperty({ example: 5230, description: 'Общее количество пользователей' })
  totalUsers!: number;

  @ApiProperty({ example: 1420, description: 'Общее количество бронирований' })
  totalBookings!: number;

  @ApiProperty({ example: 9876540, description: 'Общий доход за период' })
  totalRevenue!: number;

  @ApiProperty({ example: 5.2, description: 'Рост пользователей в процентах' })
  usersGrowth!: number;

  @ApiProperty({ example: 3.8, description: 'Рост бронирований в процентах' })
  bookingsGrowth!: number;

  @ApiProperty({ example: 4.1, description: 'Рост дохода в процентах' })
  revenueGrowth!: number;

  @ApiProperty({ example: 25, description: 'Количество активных рейсов' })
  activeFlights!: number;

  @ApiProperty({
    example: 2,
    description: 'Изменение количества активных рейсов относительно прошлого периода',
  })
  activeFlightsDelta!: number;

  @ApiProperty({ type: [MonthlyRevenueDto], description: 'Доход по месяцам' })
  monthlyRevenue!: MonthlyRevenueDto[];

  @ApiProperty({ type: [BookingStatusDto], description: 'Бронирования по статусам' })
  bookingsByStatus!: BookingStatusDto[];

  @ApiProperty({ type: [TopRouteDto], description: 'Топ маршрутов по бронированиям' })
  topRoutes!: TopRouteDto[];
}
