import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  const prisma = {
    user: { count: jest.fn() },
    booking: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    transaction: { aggregate: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const domainAnalytics = {
    getEventAnalytics: jest.fn(),
  };

  const service = new AdminDashboardService(prisma as never, domainAnalytics as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5);
    prisma.booking.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(9);
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: '10000' } })
      .mockResolvedValueOnce({ _sum: { amount: '2000' } })
      .mockResolvedValueOnce({ _sum: { amount: '1000' } });
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.booking.groupBy.mockResolvedValue([
      { status: 'PAID', _count: { status: 3 } },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    domainAnalytics.getEventAnalytics.mockResolvedValue({
      periodDays: 30,
      health: { lastEventAt: null, processedEventCount: 0 },
      counts: {},
      conversionRate: 0,
      ticketRate: 0,
      paymentVolume: 0,
      dailyActivity: [],
    });
  });

  it('aggregates dashboard stats with growth percentages', async () => {
    const result = await service.getDashboardStats();

    expect(result).toEqual(
      expect.objectContaining({
        totalUsers: 100,
        totalBookings: 50,
        totalRevenue: 10000,
        usersGrowth: 100,
        bookingsGrowth: 100,
        revenueGrowth: 100,
        activeFlights: 12,
        activeFlightsDelta: 3,
        bookingsByStatus: [{ name: 'PAID', value: 3 }],
        topRoutes: [],
      }),
    );
    expect(domainAnalytics.getEventAnalytics).toHaveBeenCalledWith(30);
  });
});
