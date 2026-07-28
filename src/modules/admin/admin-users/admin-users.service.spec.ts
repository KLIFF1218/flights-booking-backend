import { NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new AdminUsersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops.map((op) => (typeof op === 'function' ? op() : op)));
      }

      return typeof ops === 'function' ? ops(prisma) : ops;
    });
  });

  describe('findAll', () => {
    it('aggregates totalSpent in a single groupBy instead of per-user queries', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'a@test.com',
          firstName: 'Ann',
          lastName: 'A',
          createdAt: new Date('2025-01-01'),
          status: UserStatus.ACTIVE,
          _count: { bookings: 2 },
        },
        {
          id: 'user-2',
          email: 'b@test.com',
          firstName: 'Bob',
          lastName: 'B',
          createdAt: new Date('2025-01-02'),
          status: UserStatus.BLOCKED,
          _count: { bookings: 0 },
        },
      ];

      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(2);
      prisma.transaction.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { amount: '1500.50' } },
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'user-1',
          totalSpent: 1500.5,
          totalBookings: 2,
          status: 'active',
        }),
        expect.objectContaining({
          id: 'user-2',
          totalSpent: 0,
          status: 'blocked',
        }),
      ]);
    });

    it('includes exact user id match in search OR clause', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.findAll({ search: 'cluser123', page: 1, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([{ id: 'cluser123' }]),
          },
        }),
      );
    });
  });

  describe('blockUser', () => {
    it('returns user without password and revokes refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        status: UserStatus.BLOCKED,
        role: 'USER',
        firstName: 'Ann',
        lastName: 'A',
        currency: 'RUB',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.blockUser('user-1');

      expect(result).not.toHaveProperty('password');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'ADMIN',
        },
      });
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.blockUser('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('unblockUser', () => {
    it('sets user status to ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        status: UserStatus.ACTIVE,
        role: 'USER',
        firstName: 'Ann',
        lastName: 'A',
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.unblockUser('user-1');

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps totalSpent to a number', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        firstName: 'Ann',
        lastName: 'A',
        createdAt: new Date('2025-01-01'),
        status: UserStatus.ACTIVE,
        _count: { bookings: 1 },
      });
      prisma.transaction.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { amount: '99.99' } },
      ]);

      const result = await service.findOne('user-1');

      expect(result.totalSpent).toBe(99.99);
      expect(result).not.toHaveProperty('password');
    });
  });
});
