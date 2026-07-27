import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminUsersQueryDto } from './dtos/admin-users-query.dto';
import { Prisma, RevokedReason, TransactionStatus, UserStatus } from '@prisma/client';

const ADMIN_USER_STATUS_SELECT = {
  id: true,
  email: true,
  status: true,
  role: true,
  firstName: true,
  lastName: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserWithBookingCount = Prisma.UserGetPayload<{
  include: { _count: { select: { bookings: true } } };
}>;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { id: query.search },
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              bookings: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const spentByUserId = await this.loadTotalSpentByUserIds(users.map((user) => user.id));

    return {
      data: users.map((user) => this.toSummary(user, spentByUserId.get(user.id) ?? 0)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const spentByUserId = await this.loadTotalSpentByUserIds([id]);

    return this.toSummary(user, spentByUserId.get(id) ?? 0);
  }

  async blockUser(id: string) {
    await this.ensureUserExists(id);

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.BLOCKED },
        select: ADMIN_USER_STATUS_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: RevokedReason.ADMIN,
        },
      }),
    ]);

    return user;
  }

  async unblockUser(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
      select: ADMIN_USER_STATUS_SELECT,
    });
  }

  private async loadTotalSpentByUserIds(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const aggregates = await this.prisma.transaction.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        status: TransactionStatus.SUCCEED,
      },
      _sum: {
        amount: true,
      },
    });

    return new Map(aggregates.map((row) => [row.userId, Number(row._sum.amount ?? 0)]));
  }

  private toSummary(user: UserWithBookingCount, totalSpent: number) {
    return {
      id: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      email: user.email,
      registrationDate: user.createdAt,
      totalBookings: user._count.bookings,
      totalSpent,
      status: user.status.toLowerCase(),
    };
  }

  private async ensureUserExists(id: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}
