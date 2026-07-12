import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { Prisma, TransactionStatus, UserStatus } from '@prisma/client';

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

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const totalSpent = await this.prisma.transaction.aggregate({
          where: {
            userId: user.id,
            status: TransactionStatus.SUCCEED,
          },
          _sum: {
            amount: true,
          },
        });

        return {
          id: user.id,
          name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
          email: user.email,
          registrationDate: user.createdAt,
          totalBookings: user._count.bookings,
          totalSpent: totalSpent._sum.amount ?? 0,
          status: user.status.toLowerCase(),
        };
      }),
    );

    return {
      data: usersWithStats,
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

    const totalSpent = await this.prisma.transaction.aggregate({
      where: {
        userId: id,
        status: TransactionStatus.SUCCEED,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      id: user.id,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      email: user.email,
      registrationDate: user.createdAt,
      totalBookings: user._count.bookings,
      totalSpent: totalSpent._sum.amount ?? 0,
      status: user.status.toLowerCase(),
    };
  }

  async blockUser(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.BLOCKED },
    });
  }

  async unblockUser(id: string) {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });
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
