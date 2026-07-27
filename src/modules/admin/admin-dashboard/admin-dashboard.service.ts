import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DashboardStatsDto } from './dtos/admin-dashboard-stats.dto';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';
import { extractRouteFromSnapshot } from 'src/modules/bookings/utils/booking-snapshot.util';
import { DomainAnalyticsService } from 'src/infra/analytics/domain-analytics.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainAnalytics: DomainAnalyticsService,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const now = new Date();

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const totalUsers = await this.prisma.user.count();
    const totalBookings = await this.prisma.booking.count();

    const revenueAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: TransactionStatus.SUCCEED },
    });

    const totalRevenue = Number(revenueAgg._sum.amount ?? 0);

    const currentMonthUsers = await this.prisma.user.count({
      where: { createdAt: { gte: startOfCurrentMonth } },
    });

    const prevMonthUsers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfPrevMonth,
          lt: startOfCurrentMonth,
        },
      },
    });

    const usersGrowth = this.calcGrowth(currentMonthUsers, prevMonthUsers);

    const currentMonthBookings = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfCurrentMonth } },
    });

    const prevMonthBookings = await this.prisma.booking.count({
      where: {
        createdAt: {
          gte: startOfPrevMonth,
          lt: startOfCurrentMonth,
        },
      },
    });

    const bookingsGrowth = this.calcGrowth(currentMonthBookings, prevMonthBookings);

    const currentMonthRevenueAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        status: TransactionStatus.SUCCEED,
        createdAt: { gte: startOfCurrentMonth },
      },
    });

    const prevMonthRevenueAgg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        status: TransactionStatus.SUCCEED,
        createdAt: {
          gte: startOfPrevMonth,
          lt: startOfCurrentMonth,
        },
      },
    });

    const revenueGrowth = this.calcGrowth(
      Number(currentMonthRevenueAgg._sum.amount ?? 0),
      Number(prevMonthRevenueAgg._sum.amount ?? 0),
    );

    const activeStatuses = [
      BookingStatus.PNR_CREATED,
      BookingStatus.SEATS_SELECTED,
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.PAID,
      BookingStatus.TICKETING,
    ];

    const activeFlights = await this.prisma.booking.count({
      where: { status: { in: activeStatuses } },
    });

    const activeFlightsWeekAgo = await this.prisma.booking.count({
      where: {
        status: { in: activeStatuses },
        updatedAt: { gte: weekAgo },
      },
    });

    const activeFlightsDelta = activeFlights - activeFlightsWeekAgo;

    const rawMonthlyRevenue = await this.prisma.$queryRaw<{ month: Date; revenue: unknown }[]>`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        SUM("amount") as revenue
      FROM "Transaction"
      WHERE status = 'SUCCEED'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month
    `;

    const monthlyRevenue = rawMonthlyRevenue.map((item) => ({
      month: this.formatMonth(item.month),
      revenue: Number(item.revenue),
    }));

    const groupedByStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const bookingsByStatus = groupedByStatus.map((item) => ({
      name: item.status,
      value: item._count.status,
    }));

    const bookingsWithSnapshots = await this.prisma.booking.findMany({
      select: { snapshot: true },
    });

    const routeMap = new Map<string, number>();
    for (const booking of bookingsWithSnapshots) {
      try {
        const snapshot = booking.snapshot as unknown as BookingSnapshot;
        const { origin, destination } = extractRouteFromSnapshot(snapshot);
        const route = `${origin}-${destination}`;
        routeMap.set(route, (routeMap.get(route) ?? 0) + 1);
      } catch {
        // skip bookings with invalid or legacy snapshots
      }
    }

    const topRoutes = Array.from(routeMap.entries())
      .map(([route, count]) => ({
        route,
        bookings: count,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    const eventAnalytics = await this.domainAnalytics.getEventAnalytics(30);

    return {
      totalUsers,
      totalBookings,
      totalRevenue,
      usersGrowth,
      bookingsGrowth,
      revenueGrowth,
      activeFlights,
      activeFlightsDelta,
      monthlyRevenue,
      bookingsByStatus,
      topRoutes,
      eventAnalytics,
    };
  }

  private calcGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private formatMonth(date: Date): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[date.getMonth()];
  }
}
